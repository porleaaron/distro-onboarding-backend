import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as route53_targets from "aws-cdk-lib/aws-route53-targets";
import { ARecord, IHostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
import * as iam from "aws-cdk-lib/aws-iam";
import { RetainedLambdaLayerVersion } from "./retained-lambda-layer";

export interface LambdasProps {
  appName: string;
  hostedZone: IHostedZone;
  lambdasHostname: string;
  hasuraHostname: string;
  hasuraUrl: string;
  hasuraAdminSecret: string;
  externalDepsLayer: RetainedLambdaLayerVersion;
}

export class LambdasConstruct extends Construct {
  constructor(scope: Construct, id: string, props: LambdasProps) {
    super(scope, id);

    // Api Client Certificate
    const cfnClientCertificate = new apigateway.CfnClientCertificate(
      this,
      "LambdasApiClientCertificate",
      {
        description: "LambdasApi client certificate",
      }
    );

    const certificate = new DnsValidatedCertificate(this, "Certificate", {
      hostedZone: props.hostedZone,
      domainName: props.lambdasHostname,
    });

    // Create API Gateway
    const api = new apigateway.RestApi(this, "Api", {
      domainName: {
        domainName: props.lambdasHostname,
        certificate: certificate,
      },
      description: "ApiGateway For AWS Lambdas",
      defaultCorsPreflightOptions: {
        allowHeaders: ["*"],
        allowMethods: ["*"],
        allowOrigins: ["*"],
      },
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        clientCertificateId: cfnClientCertificate.attrClientCertificateId,
        tracingEnabled: true,
      },
    });

    const gw = new route53_targets.ApiGateway(api);

    // API DNS record
    new ARecord(this, "ApiAliasRecord", {
      zone: props.hostedZone,
      recordName: props.lambdasHostname,
      target: RecordTarget.fromAlias(gw),
    });

    const listCognitoUsers = new lambda.Function(this, "listCognitoUsers", {
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 1024,
      layers: [props.externalDepsLayer],
      handler: "index.listCognitoUsers",
      code: lambda.Code.fromAsset("src/handlers/auth", {
        exclude: ["*.ts"],
      }),
      timeout: Duration.seconds(4),
      environment: {
        appName: props.appName,
        hasuraUrl: props.hasuraUrl,
        hasuraAdminSecret: props.hasuraAdminSecret,
      },
    });

    const getCognitoUser = new lambda.Function(this, "getCognitoUser", {
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 1024,
      layers: [props.externalDepsLayer],
      handler: "index.getCognitoUser",
      code: lambda.Code.fromAsset("src/handlers/auth", {
        exclude: ["*.ts"],
      }),
      timeout: Duration.seconds(4),
      environment: {
        appName: props.appName,
        hasuraUrl: props.hasuraUrl,
        hasuraAdminSecret: props.hasuraAdminSecret,
      },
    });

    const createCognitoUser = new lambda.Function(this, "createCognitoUser", {
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 1024,
      layers: [props.externalDepsLayer],
      handler: "index.createCognitoUser",
      code: lambda.Code.fromAsset("src/handlers/auth", {
        exclude: ["*.ts"],
      }),
      timeout: Duration.seconds(4),
      environment: {
        appName: props.appName,
        hasuraUrl: props.hasuraUrl,
        hasuraAdminSecret: props.hasuraAdminSecret,
      },
    });

    const createCognitoUserPublic = new lambda.Function(
      this,
      "createCognitoUserPublic",
      {
        runtime: lambda.Runtime.NODEJS_14_X,
        memorySize: 1024,
        layers: [props.externalDepsLayer],
        handler: "index.createCognitoUserPublic",
        code: lambda.Code.fromAsset("src/handlers/auth", {
          exclude: ["*.ts"],
        }),
        timeout: Duration.seconds(4),
        environment: {
          appName: props.appName,
          hasuraUrl: props.hasuraUrl,
          hasuraAdminSecret: props.hasuraAdminSecret,
        },
      }
    );

    const deleteCognitoUser = new lambda.Function(this, "deleteCognitoUser", {
      runtime: lambda.Runtime.NODEJS_14_X,
      memorySize: 1024,
      layers: [props.externalDepsLayer],
      handler: "index.deleteCognitoUser",
      code: lambda.Code.fromAsset("src/handlers/auth", {
        exclude: ["*.ts"],
      }),
      timeout: Duration.seconds(4),
      environment: {
        appName: props.appName,
        hasuraUrl: props.hasuraUrl,
        hasuraAdminSecret: props.hasuraAdminSecret,
      },
    });

    const secretReadPolicy = new iam.PolicyStatement({
      actions: ["secretsmanager:GetSecretValue"],
      resources: ["*"],
    });

    const cognitoPolicy = new iam.PolicyStatement({
      actions: [
        "cognito-idp:ListUsers",
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminDeleteUser",
      ],
      resources: ["*"],
    });

    //allow each lambda to read secrets and access cognito
    listCognitoUsers.role?.attachInlinePolicy(
      new iam.Policy(this, "list-read-secret-policy", {
        statements: [secretReadPolicy, cognitoPolicy],
      })
    );

    getCognitoUser.role?.attachInlinePolicy(
      new iam.Policy(this, "get-read-secret-policy", {
        statements: [secretReadPolicy, cognitoPolicy],
      })
    );

    createCognitoUser.role?.attachInlinePolicy(
      new iam.Policy(this, "create-read-secret-policy", {
        statements: [secretReadPolicy, cognitoPolicy],
      })
    );

    createCognitoUserPublic.role?.attachInlinePolicy(
      new iam.Policy(this, "create-read-secret-policy-public", {
        statements: [secretReadPolicy, cognitoPolicy],
      })
    );

    deleteCognitoUser.role?.attachInlinePolicy(
      new iam.Policy(this, "delete-read-secret-policy", {
        statements: [secretReadPolicy, cognitoPolicy],
      })
    );

    const authRoot = api.root.addResource("authApi");

    authRoot
      .addResource("listCognitoUsers")
      .addMethod("POST", new apigateway.LambdaIntegration(listCognitoUsers));
    authRoot
      .addResource("getCognitoUser")
      .addMethod("POST", new apigateway.LambdaIntegration(getCognitoUser));
    authRoot
      .addResource("createCognitoUser")
      .addMethod("POST", new apigateway.LambdaIntegration(createCognitoUser));
    authRoot
      .addResource("createCognitoUserPublic")
      .addMethod(
        "POST",
        new apigateway.LambdaIntegration(createCognitoUserPublic)
      );
    authRoot
      .addResource("deleteCognitoUser")
      .addMethod("POST", new apigateway.LambdaIntegration(deleteCognitoUser));

    // GraphQL Function
    const graphqlFn = new lambda.Function(this, "graphql", {
      runtime: lambda.Runtime.NODEJS_14_X,
      layers: [props.externalDepsLayer],
      handler: "index.main",
      code: lambda.Code.fromAsset("src/handlers/gql", {
        exclude: ["*.ts"],
      }),
      environment: {
        HASURA_URL: props.hasuraUrl,
        HASURA_ADMIN_SECRET: props.hasuraAdminSecret,
      },
    });

    // Add API route, and add event to the lambda function
    const gqlRoot = api.root.addResource("gql");
    gqlRoot.addMethod("Any", new apigateway.LambdaIntegration(graphqlFn));
  }
}
