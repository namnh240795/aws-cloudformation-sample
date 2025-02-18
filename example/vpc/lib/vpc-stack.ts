import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

interface VpcStackProps extends cdk.StackProps {
  environment: string;
  maxAzs: number;
  publicCidrMask: number;
  privateCidrMask: number;
  isolatedCidrMask: number;
  natGateways: number;
  ipAddresses: string;
}

export class VpcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    new cdk.Tag("environment", props.environment);
    // The code that defines your stack goes here

    const vpc = new cdk.aws_ec2.Vpc(this, "vpc", {
      ipAddresses: cdk.aws_ec2.IpAddresses.cidr(props.ipAddresses),
      maxAzs: props.maxAzs,
      natGateways: props.natGateways,
      subnetConfiguration: [
        {
          cidrMask: props.publicCidrMask,
          name: "Public",
          subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: props.privateCidrMask,
          name: "Private",
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: props.isolatedCidrMask,
          name: "Isolated",
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });
  }
}
