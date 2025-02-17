import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

interface CloudfrontS3OacStackProps extends cdk.StackProps {
  environment: string;
  oidcDeploymentRole?: {
    oidcProviderArn: string;
    repoName: string;
    orgName: string;
  };
  dns?: {
    certificateArn: string;
    domainName: string[];
  }
}

export class CloudfrontS3OacStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudfrontS3OacStackProps) {
    super(scope, id, props);

    const bucket = new cdk.aws_s3.Bucket(this, "spa-bucket", {
      bucketName: `${props.environment}-spa-bucket`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      versioned: true,
      publicReadAccess: false,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
    });

    const spaCloudfrontOAC = new cdk.aws_cloudfront.S3OriginAccessControl(
      this,
      "spa-cf-oac",
      {
        originAccessControlName: `${props.environment}-spa-cf-oac`,
        description: "SPA Cloudfront Origin Access Control",
      }
    );

    const functionCode = `
    function handler(event) {
        var request = event.request;
        var uri = request.uri;
        if (uri.endsWith('/')) {
            request.uri += 'index.html';
        } else if (!uri.includes('.')) {
            request.uri = '/index.html';
        }

        return request;
      }
  `;

    const origin =
      cdk.aws_cloudfront_origins.S3BucketOrigin.withOriginAccessControl(
        bucket,
        {
          originAccessControl: spaCloudfrontOAC,
        }
      );
    
    let extendsSpaProps = {};

    if (props.dns) {
      const certificate = cdk.aws_certificatemanager.Certificate.fromCertificateArn(
        this,
        `${props.environment}-certificate`,
        props.dns.certificateArn
      );
      extendsSpaProps = {
        certificate: certificate,
        domainNames: props.dns.domainName,
      };
    }

    const spaDistribution = new cdk.aws_cloudfront.Distribution(
      this,
      `spaCloudfrontDistribution`,
      {
        // certificate: certificate, //certificate
        // domainNames: [`${props.environment}.example.com`],
        ...extendsSpaProps,
        defaultRootObject: "index.html",
        minimumProtocolVersion:
          cdk.aws_cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        defaultBehavior: {
          origin: origin,

          compress: true,
          allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cdk.aws_cloudfront.CachedMethods.CACHE_GET_HEAD,
          viewerProtocolPolicy:
            cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          functionAssociations: [
            {
              eventType: cdk.aws_cloudfront.FunctionEventType.VIEWER_REQUEST,
              function: new cdk.aws_cloudfront.Function(this, `spa-cf-func`, {
                functionName: `${props.environment}-spa-cf-function`,
                code: cdk.aws_cloudfront.FunctionCode.fromInline(functionCode),
              }),
            },
          ],
        },
        geoRestriction: {
          restrictionType: "whitelist",
          locations: ["AU", "VN", "IN", "US"],
        },
      }
    );

    if (props.oidcDeploymentRole) {
      const oidcProvider =
        cdk.aws_iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
          this,
          `${props.environment}-oidc-provider`,
          props.oidcDeploymentRole.oidcProviderArn
        );
      // grant role to have permission to deploy aws resources on specific branch
      const webDevDeploymentRole = new cdk.aws_iam.Role(
        this,
        `${props.environment}-spa-cf-deployment-role`,
        {
          roleName: `${props.environment}-spa-cf-deployment-role`,
          assumedBy: new cdk.aws_iam.FederatedPrincipal(
            oidcProvider.openIdConnectProviderArn,
            {
              StringEquals: {
                "token.actions.githubusercontent.com:sub": `repo:${props.oidcDeploymentRole.orgName}/${props.oidcDeploymentRole.orgName}:ref:refs/heads/${props.environment}`,
                "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
              },
            },
            "sts:AssumeRoleWithWebIdentity"
          ),
        }
      );

      bucket.addToResourcePolicy(
        new cdk.aws_iam.PolicyStatement({
          actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
          resources: [`${bucket.bucketArn}/*`],
          effect: cdk.aws_iam.Effect.ALLOW,
          principals: [webDevDeploymentRole],
        })
      );

      bucket.addToResourcePolicy(
        new cdk.aws_iam.PolicyStatement({
          actions: ["s3:ListBucket"],
          resources: [bucket.bucketArn],
          effect: cdk.aws_iam.Effect.ALLOW,
          principals: [webDevDeploymentRole],
        })
      );

      spaDistribution.grantCreateInvalidation(webDevDeploymentRole);
    }
  }
}
