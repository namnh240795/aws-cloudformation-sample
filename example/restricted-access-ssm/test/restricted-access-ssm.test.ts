import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { RestrictedAccessSsmStack } from "../lib/restricted-access-ssm-stack";

describe("RestrictedAccessSsmStack", () => {
  const app = new cdk.App();
  const stack = new RestrictedAccessSsmStack(app, "TestStack", {
    environment: "test",
    maxAzs: 2,
    publicCidrMask: 24,
    privateCidrMask: 24,
    isolatedCidrMask: 28,
    natGateways: 1,
    ipAddresses: "10.0.0.0/16",
  });
  const template = Template.fromStack(stack);

  test("VPC is created with correct configuration", () => {
    template.hasResourceProperties("AWS::EC2::VPC", {
      CidrBlock: "10.0.0.0/16",
      EnableDnsSupport: true,
      EnableDnsHostnames: true,
    });
  });

  test("Subnets are created with correct configuration", () => {
    template.resourceCountIs("AWS::EC2::Subnet", 6); // 2 AZs * 3 subnet types
    template.hasResourceProperties("AWS::EC2::Subnet", {
      MapPublicIpOnLaunch: true,
    });
  });

  test("Key pair is created", () => {
    template.hasResourceProperties("AWS::EC2::KeyPair", {
      KeyName: "test-keypair",
      KeyType: "rsa",
    });
  });

  test("IAM Role for SSM is created", () => {
    template.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "ec2.amazonaws.com",
            },
          },
        ],
        Version: "2012-10-17",
      },
    });
  });

  test("EC2 instance is created with correct properties", () => {
    template.hasResourceProperties("AWS::EC2::Instance", {
      InstanceType: "t2.micro",
      KeyName: "test-keypair",
      Tags: [
        {
          Key: "Name",
          Value: "test-ec2-internal-instance",
        },
      ],
    });
  });

  test("IAM Instance Profile is created", () => {
    template.hasResourceProperties("AWS::IAM::InstanceProfile", {
      Roles: [
        {
          Ref: "SSMRole4E0C2080", // Update to match the generated logical ID
        },
      ],
    });
  });

 
});
