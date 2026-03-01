#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MarchMadnessAuctionStack } from '../lib/march-madness-auction-stack';

const app = new cdk.App();
new MarchMadnessAuctionStack(app, 'MarchMadnessAuctionStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
