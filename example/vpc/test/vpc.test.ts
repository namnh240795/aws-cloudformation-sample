import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { VpcStack } from "../lib/vpc-stack";

test("VPC Stack creates a VPC with correct properties", () => {
  const app = new cdk.App();
  const stack = new VpcStack(app, "TestVpcStack", {
    environment: "test",
    maxAzs: 2,
    publicCidrMask: 24,
    privateCidrMask: 20,
    isolatedCidrMask: 20,
    natGateways: 1,
    ipAddresses: "10.0.0.0/16",
  });

  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::EC2::VPC", {
    CidrBlock: "10.0.0.0/16",
  });

  template.resourceCountIs("AWS::EC2::VPC", 1);
});

test("VPC Stack creates subnets with correct properties", () => {
  const app = new cdk.App();
  const stack = new VpcStack(app, "TestVpcStack", {
    environment: "test",
    maxAzs: 2,
    publicCidrMask: 24,
    privateCidrMask: 20,
    isolatedCidrMask: 20,
    natGateways: 1,
    ipAddresses: "10.0.0.0/16",
  });

  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::EC2::Subnet", {
    CidrBlock: "10.0.0.0/24",
    MapPublicIpOnLaunch: true,
  });

  template.hasResourceProperties("AWS::EC2::Subnet", {
    CidrBlock: "10.0.16.0/20",
    MapPublicIpOnLaunch: false,
  });

  template.hasResourceProperties("AWS::EC2::Subnet", {
    CidrBlock: "10.0.32.0/20",
    MapPublicIpOnLaunch: false,
  });
});

test("VPC Stack creates NAT Gateways", () => {
  const app = new cdk.App();
  const stack = new VpcStack(app, "TestVpcStack", {
    environment: "test",
    maxAzs: 2,
    publicCidrMask: 24,
    privateCidrMask: 20,
    isolatedCidrMask: 20,
    natGateways: 1,
    ipAddresses: "10.0.0.0/16",
  });

  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::EC2::NatGateway", 1);
});
