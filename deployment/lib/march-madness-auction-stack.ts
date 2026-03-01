import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';

export class MarchMadnessAuctionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
      vpcId: 'vpc-4c956e31',
    });
    const ecsInstanceSg = ec2.SecurityGroup.fromSecurityGroupId(this, 'ExistingSG', 'sg-0c98db13970d87296');
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
      image: ecs.ContainerImage.fromRegistry(`${props?.env?.account}.dkr.ecr.us-east-1.amazonaws.com/march-madness-auction:frontend.v2.0.0`), // Update this with newest version to deploy latest changes
      cpu: 256,
      memoryLimitMiB: 512,
      containerName: 'march-madness-auction-frontend',
      essential: true,
      environment: {
        'REACT_APP_BACKEND_PORT': '80',
        'REACT_APP_BACKEND_HOST': 'mmauctiongame.com'
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

    new ecs.Ec2Service(this, 'FrontEndService', {
      cluster: cluster,
      taskDefinition: frontEndTaskDef,
      desiredCount: 1,
      minHealthyPercent: 100
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
      image: ecs.ContainerImage.fromRegistry(`${props?.env?.account}.dkr.ecr.us-east-1.amazonaws.com/march-madness-auction:backend.v2.0.0`), // Update this with newest version to deploy latest changes
      cpu: 256,
      memoryLimitMiB: 256,
      containerName: 'march-madness-auction-backend',
      essential: true,
      environment: {
        'UVICORN_PORT': '8000',
        'UVICORN_HOST': '0.0.0.0',
        'UVICORN_LOG_LEVEL': 'info'
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

    new ecs.Ec2Service(this, 'BackEndService', {
      cluster: cluster,
      taskDefinition: backEndTaskDef,
      desiredCount: 1,
      minHealthyPercent: 100
    });

    const hostedZone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: 'mmauctiongame.com'
    });

    // Comment this out until we have the IP of the ec2 created
    // Then uncomment and replace IP address and run cdk deploy
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromIpAddresses('13.222.10.27')
    });
  }
}
