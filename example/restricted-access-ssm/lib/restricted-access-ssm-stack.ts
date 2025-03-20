import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

interface RestrictedAccessSsmStackProps extends cdk.StackProps {
  environment: string;
  maxAzs: number;
  publicCidrMask: number;
  privateCidrMask: number;
  isolatedCidrMask: number;
  natGateways: number;
  ipAddresses: string;
}

export class RestrictedAccessSsmStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: RestrictedAccessSsmStackProps
  ) {
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

    const linuxAmi = new cdk.aws_ec2.AmazonLinuxImage({
      generation: cdk.aws_ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
    });

    const keyPair = new cdk.aws_ec2.CfnKeyPair(this, `keypair`, {
      keyName: `${props.environment}-keypair`,
      keyType: cdk.aws_ec2.KeyPairType.RSA,
    });

    const ssmRole = new cdk.aws_iam.Role(this, "SSMRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
    });

    const ec2Instance = new cdk.aws_ec2.CfnInstance(this, `ec2Internal`, {
      imageId: linuxAmi.getImage(this).imageId,
      instanceType: "t2.micro",
      keyName: keyPair.keyName,
      subnetId: vpc.privateSubnets[0].subnetId,
      securityGroupIds: [],
      iamInstanceProfile: new cdk.aws_iam.CfnInstanceProfile(
        this,
        "InstanceProfile",
        {
          roles: [ssmRole.roleName],
        }
      ).ref,
      tags: [
        {
          key: "Name",
          value: `${props.environment}-ec2-internal-instance`,
        },
      ],
      userData: cdk.Fn.base64(`
        #!/bin/bash
        yum update -y
        yum install -y amazon-ssm-agent
        systemctl enable amazon-ssm-agent
        systemctl start amazon-ssm-agent
      `),
    });

    const ec2InstanceArn = `arn:aws:ec2:ap-southeast-2:${cdk.Aws.ACCOUNT_ID}:instance/${ec2Instance.ref}`;

    const ec2Policy = new cdk.aws_iam.ManagedPolicy(this, "EC2Policy", {
      managedPolicyName: `${props.environment}-ec2-internal-policy`,
      statements: [
        new cdk.aws_iam.PolicyStatement({
          actions: ["ec2:DescribeInstances"],
          resources: ["*"],
        }),
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ["ssm:StartSession", "ssm:SendCommand"],
          resources: [
            ec2InstanceArn,
            `arn:aws:ssm:ap-southeast-2:${cdk.Aws.ACCOUNT_ID}:document/SSM-SessionManagerRunShell`,
          ],
        }),
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: [
            "ssm:GetConnectionStatus",
            "ssm:DescribeInstanceInformation",
          ],
          resources: ["*"],
        }),
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          actions: ["ssm:TerminateSession", "ssm:ResumeSession"],
          resources: [
            cdk.Fn.sub("arn:aws:ssm:*:*:session/\${aws:userid}-*"), // Wrap Fn.sub in an array
          ],
        }),
      ],
    });
  }
}
