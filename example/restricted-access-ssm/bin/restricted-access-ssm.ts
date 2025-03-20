#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { RestrictedAccessSsmStack } from '../lib/restricted-access-ssm-stack';

const app = new cdk.App();

new RestrictedAccessSsmStack(app, 'RestrictedAccessSsmStack', {
  environment: 'dev',
  maxAzs: 2,
  publicCidrMask: 24,
  privateCidrMask: 20,
  isolatedCidrMask: 20,
  natGateways: 1,
  ipAddresses: '10.0.0.0/16',
});