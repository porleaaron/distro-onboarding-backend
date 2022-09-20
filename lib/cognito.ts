import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { CfnOutput, Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsManager from "aws-cdk-lib/aws-secretsmanager";
import * as iam from "aws-cdk-lib/aws-iam";
import { RetainedLambdaLayerVersion } from "./retained-lambda-layer";

export interface CognitoServiceProps {
  region: string;
  appName: string;
  hasuraUrl: string;
  hasuraAdminSecret: string;
  externalDepsLayer: RetainedLambdaLayerVersion;
}

export class CognitoConstruct extends Construct {
  private userPool: cognito.UserPool;

  constructor(scope: Construct, id: string, props: CognitoServiceProps) {
    super(scope, id);

    const signinHandler = new lambda.Function(this, "fnSigninHandler", {
      runtime: lambda.Runtime.NODEJS_14_X,
      layers: [props.externalDepsLayer],
      handler: "index.signinHandler",
      code: lambda.Code.fromAsset("src/triggers/cognito_hooks", {exclude: ["*.ts"]}),
      timeout: Duration.seconds(4),
      environment: {
        hasuraUrl: props.hasuraUrl,
        hasuraAdminSecret: props.hasuraAdminSecret,
      },
    });

    const signupHandler = new lambda.Function(this, "fnSignupHandler", {
      runtime: lambda.Runtime.NODEJS_14_X,
      layers: [props.externalDepsLayer],
      handler: "index.signupHandler",
      code: lambda.Code.fromAsset("src/triggers/cognito_hooks", {exclude: ["*.ts"]}),
      timeout: Duration.seconds(4),
      environment: {
        hasuraUrl: props.hasuraUrl,
        hasuraAdminSecret: props.hasuraAdminSecret,
      },
    });

    this.userPool = new cognito.UserPool(this, "user-pool", {
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lambdaTriggers: {
        postConfirmation: signupHandler,
        preTokenGeneration: signinHandler,
      },

      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        givenName: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        accountId: new cognito.StringAttribute({ minLen: 36, maxLen: 36 }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    const client = this.userPool.addClient("client");

    const identityPool = new cognito.CfnIdentityPool(
      this,
      "MyCognitoIdentityPool",
      {
        allowUnauthenticatedIdentities: true,
        cognitoIdentityProviders: [
          {
            clientId: client.userPoolClientId,
            providerName: this.userPool.userPoolProviderName,
          },
        ],
      }
    );

    const isAnonymousCognitoGroupRole = new iam.Role(
      this,
      "anonymous-group-role",
      {
        description: "Default role for anonymous users",
        assumedBy: new iam.FederatedPrincipal(
          "cognito-identity.amazonaws.com",
          {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": identityPool.ref,
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": "unauthenticated",
            },
          },
          "sts:AssumeRoleWithWebIdentity"
        ),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "service-role/AWSLambdaBasicExecutionRole"
          ),
        ],
      }
    );

    const isUserCognitoGroupRole = new iam.Role(this, "users-group-role", {
      description: "Default role for authenticated users",
      assumedBy: new iam.FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": identityPool.ref,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "authenticated",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    new cognito.CfnIdentityPoolRoleAttachment(
      this,
      "identity-pool-role-attachment",
      {
        identityPoolId: identityPool.ref,
        roles: {
          authenticated: isUserCognitoGroupRole.roleArn,
          unauthenticated: isAnonymousCognitoGroupRole.roleArn,
        },
        roleMappings: {
          mapping: {
            type: "Token",
            ambiguousRoleResolution: "AuthenticatedRole",
            identityProvider: `cognito-idp.${
              cdk.Stack.of(this).region
            }.amazonaws.com/${this.userPool.userPoolId}:${
              client.userPoolClientId
            }`,
          },
        },
      }
    );

    const bucket = new s3.Bucket(this, `CognitoBucket`, {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(90),
          expiration: cdk.Duration.days(365),
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
    });

    bucket.grantReadWrite(isUserCognitoGroupRole);

    new cdk.CfnOutput(this, "FileBucketURL", {
      value: bucket.bucketDomainName,
    });

    const cognitoSecret = new secretsManager.Secret(this, "CognitoSecret");

    new CfnOutput(this, "SecretArn", {
      value: cognitoSecret.secretArn,
    });

    new CfnOutput(this, "UserPool", {
      value: this.userPool.userPoolId,
    });

    new CfnOutput(this, "Identity", {
      value: identityPool.ref,
    });

    new CfnOutput(this, "UserPoolClient", {
      value: client.userPoolClientId,
    });
  }
}
