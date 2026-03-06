import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as targets from 'aws-cdk-lib/aws-route53-targets';

export class MarchMadnessAuctionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
      vpcId: 'vpc-4c956e31',
    });

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'mmauctiongame.com'
    });

    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: "mmauctiongame.com",
      validation: acm.CertificateValidation.fromDns(hostedZone)

    });

    certificate.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      securityGroupName: 'ALBSecurityGroup',
      description: 'Security group for ALB allowing inbound traffic on port 80 and 443'
    });

    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP traffic from anywhere');
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS traffic from anywhere');

    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup
    });

    const listener = alb.addListener('Listener', {
      port: 80,
      open: true,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true
      })
    });

    const httpsListener = alb.addListener('HTTPSListener', {
      port: 443,
      open: true,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate]
    });


    new route53.ARecord(this, 'ARecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(alb)),
    });

    const ecsInstanceSg = new ec2.SecurityGroup(this, 'ECSInstanceSG', {
      vpc,
      securityGroupName: 'ECSInstanceSG',
      description: 'Security group for ECS instances allowing inbound traffic on port 80 and 8000 from ALB'
    });
    ecsInstanceSg.addIngressRule(albSecurityGroup, ec2.Port.tcp(80), 'Allow HTTP traffic from ALB');
    ecsInstanceSg.addIngressRule(albSecurityGroup, ec2.Port.tcp(8000), 'Allow Backend traffic from ALB');
    ecsInstanceSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp(), 'Allow all outbound traffic');
    ecsInstanceSg.addIngressRule(ec2.Peer.ipv4(`${process.env.ERIC_IP}`), ec2.Port.tcp(22), 'Allow SSH from my IP for debugging');
    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      securityGroup: ecsInstanceSg,
      minCapacity: 1,
      maxCapacity: 1,
      desiredCapacity: 1,
      newInstancesProtectedFromScaleIn: false,
      keyPair: ec2.KeyPair.fromKeyPairName(this, 'KeyPair', 'march madness auction')
    });

    const capacityProvider = new ecs.AsgCapacityProvider(this, 'AsgCapacityProvider', {
      autoScalingGroup
    });


    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: 'march-madness-auction-cdk',
      vpc: vpc
    });

    cluster.addAsgCapacityProvider(capacityProvider);

    const frontEndTaskDef = new ecs.TaskDefinition(this, 'FrontEndTaskDef', {
      compatibility: ecs.Compatibility.EC2,
      cpu: '256',
      memoryMiB: '512',
      executionRole: iam.Role.fromRoleArn(this, 'FrontEndExecutionRole', `arn:aws:iam::${props?.env?.account}:role/ecsTaskExecutionRole`),
      family: 'march-madness-auction-frontend',
      networkMode: ecs.NetworkMode.BRIDGE,
    });

    frontEndTaskDef.addContainer('FrontEndContainer', {
      image: ecs.ContainerImage.fromRegistry(`${props?.env?.account}.dkr.ecr.us-east-1.amazonaws.com/march-madness-auction:frontend.pr-9`), // Update this with newest version to deploy latest changes
      cpu: 256,
      memoryLimitMiB: 512,
      containerName: 'march-madness-auction-frontend',
      essential: true,
      environment: {
        // Forces new deployment when the image is updated in ECR since timestamp changes
        'DEPLOY_TIMESTAMP': new Date().toISOString()
      },
      portMappings: [
        {
          containerPort: 3000,
          hostPort: 80,
          protocol: ecs.Protocol.TCP
        }
      ],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'frontend',
        logGroup: new logs.LogGroup(this, 'FrontEndLogGroup', {
          retention: cdk.aws_logs.RetentionDays.ONE_WEEK
        })
      })
    });

    const frontEndService = new ecs.Ec2Service(this, 'FrontEndService', {
      cluster: cluster,
      taskDefinition: frontEndTaskDef,
      desiredCount: 1,
      minHealthyPercent: 0
    });

    const backEndTaskDef = new ecs.TaskDefinition(this, 'BackEndTaskDef', {
      compatibility: ecs.Compatibility.EC2,
      cpu: '256',
      memoryMiB: '256',
      executionRole: iam.Role.fromRoleArn(this, 'BackEndExecutionRole', `arn:aws:iam::${props?.env?.account}:role/ecsTaskExecutionRole`),
      family: 'march-madness-auction-backend',
      networkMode: ecs.NetworkMode.BRIDGE,
    });

    backEndTaskDef.addContainer('BackEndContainer', {
      image: ecs.ContainerImage.fromRegistry(`${props?.env?.account}.dkr.ecr.us-east-1.amazonaws.com/march-madness-auction:backend.pr-9`), // Update this with newest version to deploy latest changes
      cpu: 256,
      memoryLimitMiB: 256,
      containerName: 'march-madness-auction-backend',
      essential: true,
      environment: {
        'UVICORN_PORT': '8000',
        'UVICORN_HOST': '0.0.0.0',
        'UVICORN_LOG_LEVEL': 'info',
        // Forces new deployment when the image is updated in ECR since timestamp changes
        'DEPLOY_TIMESTAMP': new Date().toISOString()
      },
      portMappings: [
        {
          name: 'march-madness-backend-container-8000-tcp',
          containerPort: 8000,
          hostPort: 8000,
          protocol: ecs.Protocol.TCP
        }
      ],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'backend',
        logGroup: new logs.LogGroup(this, 'BackEndLogGroup', {
          retention: cdk.aws_logs.RetentionDays.ONE_WEEK
        })
      })
    });

    const backEndService = new ecs.Ec2Service(this, 'BackEndService', {
      cluster: cluster,
      taskDefinition: backEndTaskDef,
      desiredCount: 1,
      minHealthyPercent: 0
    });

    httpsListener.addTargets('Frontend', {
      port: 80,
      targets: [frontEndService.loadBalancerTarget({
        containerName: 'march-madness-auction-frontend',
        containerPort: 3000
      })],
      healthCheck: {
        path: '/',
        port: '80',
        interval: cdk.Duration.seconds(30),
      }
    });

    httpsListener.addTargets('Backend', {
      port: 8000,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api/*'])
      ],
      priority: 10,
      targets: [backEndService.loadBalancerTarget({
        containerName: 'march-madness-auction-backend',
        containerPort: 8000
      })],
      healthCheck: {
        path: '/api/health',
        port: '8000',
      }
    });

  }
}
