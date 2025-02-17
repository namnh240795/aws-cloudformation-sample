import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { CloudfrontS3OacStack } from "../lib/cloudfront-s3-oac-stack";

test("S3 Bucket Created", () => {
  const app = new cdk.App();
  const stack = new CloudfrontS3OacStack(app, "TestStack", {
    environment: "test",
  });

  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::S3::Bucket", {
    BucketName: "test-spa-bucket",
    VersioningConfiguration: {
      Status: "Enabled",
    },
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
});

test("CloudFront Distribution Created", () => {
  const app = new cdk.App();
  const stack = new CloudfrontS3OacStack(app, "TestStack", {
    environment: "test",
  });

  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::CloudFront::Distribution", {
    DistributionConfig: {
      DefaultRootObject: "index.html",
      Origins: Match.arrayWith([
        Match.objectLike({
          S3OriginConfig: {
            OriginAccessIdentity: Match.anyValue(),
          },
        }),
      ]),
      DefaultCacheBehavior: {
        ViewerProtocolPolicy: "redirect-to-https",
        AllowedMethods: ["GET", "HEAD"],
        CachedMethods: ["GET", "HEAD"],
        FunctionAssociations: Match.arrayWith([
          Match.objectLike({
            EventType: "viewer-request",
            FunctionARN: Match.anyValue(),
          }),
        ]),
      },
      Restrictions: {
        GeoRestriction: {
          RestrictionType: "whitelist",
          Locations: ["AU", "VN", "IN", "US"],
        },
      },
    },
  });
});

test("IAM Role Created for OIDC Deployment", () => {
  const app = new cdk.App();
  const stack = new CloudfrontS3OacStack(app, "TestStack", {
    environment: "test",
  });

  const oidcProvider = new cdk.aws_iam.OpenIdConnectProvider(
    stack,
    "oidcProvider",
    {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    }
  );

  const role = new cdk.aws_iam.Role(stack, "OidcDeploymentRole", {
    roleName: "test-spa-cf-deployment-role",
    assumedBy: new cdk.aws_iam.FederatedPrincipal(
      oidcProvider.openIdConnectProviderArn,
      {
        StringEquals: {
          "token.actions.githubusercontent.com:sub":
            "repo:my-org/my-repo:ref:refs/heads/test",
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        },
      },
      "sts:AssumeRoleWithWebIdentity"
    ),
  });

  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::IAM::Role", {
    RoleName: "test-spa-cf-deployment-role",
    AssumeRolePolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: "sts:AssumeRoleWithWebIdentity",
          Condition: {
            StringEquals: {
              "token.actions.githubusercontent.com:sub":
                "repo:my-org/my-repo:ref:refs/heads/test",
              "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            },
          },
        }),
      ]),
    },
  });
});

test("S3 Bucket Policy Created", () => {
  const app = new cdk.App();
  const stack = new CloudfrontS3OacStack(app, "TestStack", {
    environment: "test",
  });

  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::S3::BucketPolicy", {
    Bucket: {
      Ref: "spabucket3221D63D",
    },
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: [
            "s3:PutBucketPolicy",
            "s3:GetBucket*",
            "s3:List*",
            "s3:DeleteObject*",
          ],
          Effect: "Allow",
          Principal: {
            AWS: {
              "Fn::GetAtt": [
                "CustomS3AutoDeleteObjectsCustomResourceProviderRole3B1BD092",
                "Arn",
              ],
            },
          },
          Resource: Match.arrayWith([
            {
              "Fn::GetAtt": ["spabucket3221D63D", "Arn"],
            },
            {
              "Fn::Join": [
                "",
                [
                  {
                    "Fn::GetAtt": ["spabucket3221D63D", "Arn"],
                  },
                  "/*",
                ],
              ],
            },
          ]),
        }),
      ]),
      Version: "2012-10-17",
    },
  });
});

test("CloudFront Origin Access Control Created", () => {
  const app = new cdk.App();
  const stack = new CloudfrontS3OacStack(app, "TestStack", {
    environment: "test",
  });

  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::CloudFront::OriginAccessControl", {
    OriginAccessControlConfig: {
      Name: "test-spa-cf-oac",
      OriginAccessControlOriginType: "s3",
      SigningBehavior: "always",
      SigningProtocol: "sigv4",
    },
  });
});

test("CloudFront Function Created", () => {
  const app = new cdk.App();
  const stack = new CloudfrontS3OacStack(app, "TestStack", {
    environment: "test",
  });

  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::CloudFront::Function", {
    Name: "test-spa-cf-function",
    FunctionConfig: {
      Comment: "test-spa-cf-function",
      Runtime: "cloudfront-js-1.0",
    },
    FunctionCode: Match.anyValue(),
  });
});

test("Certificate Imported and Domain Names Set", () => {
  const app = new cdk.App();
  const stack = new CloudfrontS3OacStack(app, "TestStack", {
    environment: "test",
    dns: {
      certificateArn:
        "arn:aws:acm:us-east-1:123456789012:certificate/abcd1234-5678-90ab-cdef-EXAMPLE11111",
      domainName: ["test.example.com"],
    },
  });

  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::CloudFront::Distribution", {
    DistributionConfig: {
      Aliases: ["test.example.com"],
      ViewerCertificate: {
        AcmCertificateArn:
          "arn:aws:acm:us-east-1:123456789012:certificate/abcd1234-5678-90ab-cdef-EXAMPLE11111",
        SslSupportMethod: "sni-only",
        MinimumProtocolVersion: "TLSv1.2_2021",
      },
    },
  });
});

test("OIDC Deployment Role and Policies Created", () => {
    const app = new cdk.App();
    const stack = new CloudfrontS3OacStack(app, "TestStack", {
        environment: "test",
        oidcDeploymentRole: {
            oidcProviderArn:
                "arn:aws:iam::123456789012:oidc-provider/oidc.eks.us-west-2.amazonaws.com/id/12345678901234567890",
            repoName: "my-repo",
            orgName: "my-org",
        },
    });

    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::CloudFront::Distribution", {
        DistributionConfig: {
            DefaultRootObject: "index.html",
            DefaultCacheBehavior: {
                AllowedMethods: ["GET", "HEAD"],
                CachedMethods: ["GET", "HEAD"],
                ViewerProtocolPolicy: "redirect-to-https",
                FunctionAssociations: Match.arrayWith([
                    Match.objectLike({
                        EventType: "viewer-request",
                        FunctionARN: Match.anyValue(),
                    }),
                ]),
            },
            Restrictions: {
                GeoRestriction: {
                    RestrictionType: "whitelist",
                    Locations: ["AU", "VN", "IN", "US"],
                },
            },
        },
    });
});
