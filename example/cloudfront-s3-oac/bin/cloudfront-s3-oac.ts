#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CloudfrontS3OacStack } from '../lib/cloudfront-s3-oac-stack';

const app = new cdk.App();
new CloudfrontS3OacStack(app, 'CloudfrontS3OacStack', {
  environment: 'dev',
  // sample
  // oidcDeploymentRole: {
  //   oidcProvider: cdk.aws_iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
  //     app,
  //     'oidcProvider',
  //     'arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-west-2.amazonaws.com/id/12345678901234567890'
  //   ),
  //   repoName: 'my-repo',
  //   orgName: 'my-org',
  // }
});