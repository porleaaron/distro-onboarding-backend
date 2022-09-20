#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DistroBackendStack } from "../lib/backend-stack";
import { config } from "dotenv";
config();

const appName = process.env.APP_NAME;
if (!appName) throw Error("APP_NAME must be defined in environment");

const region = process.env.AWS_REGION;
if (!region) throw Error("AWS_REGION must be defined in environment");

const account = process.env.AWS_ACCOUNT_ID;
if (!account) throw Error("AWS_ACCOUNT_ID must be defined in environment");

const awsProfile = process.env.AWS_PROFILE;
if (!awsProfile) throw Error("AWS_PROFILE must be defined in environment");

const hostedZoneId = process.env.HOSTED_ZONE_ID;
if (!hostedZoneId) throw Error("HOSTED_ZONE_ID must be defined in environment");

const hostedZoneName = process.env.HOSTED_ZONE_NAME;
if (!hostedZoneName)
  throw Error("HOSTED_ZONE_NAME must be defined in environment");

const hasuraHostname = process.env.HASURA_HOSTNAME;
if (!hasuraHostname)
  throw Error("HASURA_HOSTNAME must be defined in environment");

const hasuraUrl = process.env.HASURA_URL;
if (!hasuraUrl) throw Error("HASURA_URL must be defined in environment");

const hasuraAdminSecret = process.env.HASURA_ADMIN_SECRET;
if (!hasuraAdminSecret)
  throw Error("HASURA_ADMIN_SECRET must be defined in environment");

const lambdasHostname = process.env.LAMBDAS_HOSTNAME;
if (!lambdasHostname)
  throw Error("LAMBDAS_HOSTNAME must be defined in environment");

const gql_remote_schema = process.env.HASURA_GQL_REMOTE_SCHEMA;
if (!gql_remote_schema)
  throw Error("HASURA_GQL_REMOTE_SCHEMA must be defined in environment");

const app = new cdk.App();
new DistroBackendStack(app, `${appName}-Backend`, {
  multiAz: true,
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
});
