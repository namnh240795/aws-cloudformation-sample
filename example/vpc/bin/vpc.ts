#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';

const app = new cdk.App();
new VpcStack(app, 'VpcStack', {
  environment: 'dev',
  maxAzs: 2,
  publicCidrMask: 24,
  privateCidrMask: 20,
  isolatedCidrMask: 20,
  natGateways: 1,
  ipAddresses: '10.0.0.0/16',
});