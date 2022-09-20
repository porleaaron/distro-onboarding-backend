import * as cdk from "aws-cdk-lib";
import { StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CognitoConstruct } from "./cognito";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { PublicHostedZone } from "aws-cdk-lib/aws-route53";
import { RetainedLambdaLayerVersion } from "./retained-lambda-layer";
import { LambdasConstruct } from "./lambda";

interface ApplicationStackProps extends StackProps {
  multiAz: boolean;
  appName: string;
  region: string;
  awsProfile: string;
  hostedZoneId: string;
  hostedZoneName: string;
  hasuraHostname: string;
  hasuraUrl: string;
  hasuraAdminSecret: string;
  lambdasHostname: string;
  gql_remote_schema: string;
}

export class DistroBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);
    const {
      multiAz,
      appName,
      region,
      awsProfile,
      hostedZoneId,
      hostedZoneName,
      hasuraHostname,
      hasuraUrl,
      hasuraAdminSecret,
      lambdasHostname,
      gql_remote_schema,
    } = props;

    // Create a lambda layer to contain node_module (for external dependencies)
    const externalDepsLayer = new RetainedLambdaLayerVersion(
      this,
      "externalDepsLayer",
      {
        contentLocation: "externalDepsLayer",
        compatibleRuntimes: [Runtime.NODEJS_14_X],
        description: "External dependencies layer",
      }
    );

    // Cognito
    new CognitoConstruct(this, "Cognito", {
      region,
      appName,
      hasuraUrl,
      hasuraAdminSecret,
      externalDepsLayer,
    });

    const hostedZone = PublicHostedZone.fromHostedZoneAttributes(
      this,
      "HasuraHostedZone",
      {
        hostedZoneId: hostedZoneId,
        zoneName: hostedZoneName,
      }
    );

    new LambdasConstruct(this, "Lambdas", {
      appName,
      hostedZone,
      lambdasHostname,
      hasuraHostname,
      hasuraUrl,
      hasuraAdminSecret,
      externalDepsLayer,
    });
  }
}
