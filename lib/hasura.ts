import { Construct } from "constructs";
import { CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import {
  Vpc,
  InstanceType,
  InstanceClass,
  InstanceSize,
  Port,
  Protocol,
  SubnetType,
} from "aws-cdk-lib/aws-ec2";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { ContainerImage, Secret as ECSSecret } from "aws-cdk-lib/aws-ecs";
import { IHostedZone } from "aws-cdk-lib/aws-route53";
import {
  DatabaseInstance,
  DatabaseInstanceEngine,
  DatabaseSecret,
} from "aws-cdk-lib/aws-rds";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";

export interface HasuraServiceProps {
  hostedZone: IHostedZone;
  hasuraHostname: string;
  multiAz: boolean;
  lambdasHostname: string;
  appName: string;
  gql_remote_schema: string;
}

export class HasuraConstruct extends Construct {
  constructor(scope: Construct, id: string, props: HasuraServiceProps) {
    super(scope, id);

    const vpc = new Vpc(this, "MyVpc", {
      natGateways: 1,
      maxAzs: 2,
      cidr: "10.0.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Database",
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const hasuraDatabaseName = props.appName;

    const hasuraDatabase = new DatabaseInstance(this, "Database", {
      engine: DatabaseInstanceEngine.POSTGRES,
      instanceType: InstanceType.of(
        InstanceClass.BURSTABLE3,
        InstanceSize.MICRO
      ),
      databaseName: hasuraDatabaseName,
      multiAz: props.multiAz,
      storageEncrypted: true,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      vpc: vpc,
      deletionProtection: false,
      removalPolicy: RemovalPolicy.DESTROY,
      enablePerformanceInsights: true,
      monitoringInterval: Duration.seconds(60),
    });

    const hasuraUsername = "hasura";

    const hasuraUserSecret = new DatabaseSecret(this, "DatabaseUser", {
      username: hasuraUsername,
      masterSecret: hasuraDatabase.secret,
    });
    hasuraUserSecret.attach(hasuraDatabase); // Adds DB connections information in the secret

    // Output the Endpoint Address so it can be used in post-deploy
    new CfnOutput(this, "DatabaseUserSecretArn", {
      value: hasuraUserSecret.secretArn,
    });

    new CfnOutput(this, "DatabaseMasterSecretArn", {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      value: hasuraDatabase.secret!.secretArn,
    });

    const hasuraDatabaseUrlSecret = new Secret(this, "DatabaseUrlSecret");

    new CfnOutput(this, "DatabaseUrlSecretArn", {
      value: hasuraDatabaseUrlSecret.secretArn,
    });

    const hasuraAdminSecret = new Secret(this, "AdminSecret");

    new CfnOutput(this, "AdminSecretArn", {
      value: hasuraAdminSecret.secretArn,
    });

    const hasuraJwtSecret = new Secret(this, "JwtSecret");

    new CfnOutput(this, "JwtSecretArn", {
      value: hasuraJwtSecret.secretArn,
    });

    const endPointSecret = new Secret(this, "EndPointSecret");

    new CfnOutput(this, "EndPointSecretArn", {
      value: endPointSecret.secretArn,
    });

    // Create an Application Load Balancer and set attributes
    const alb = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      deletionProtection: false,
    });

    alb.setAttribute("routing.http.drop_invalid_header_fields.enabled", "true");
    //alb.setAttribute("deletion_protection.enabled", "true")
    //alb.setAttribute("access_logs.s3.enable","true");
    //alb.setAttribute("access_logs.s3.bucket",props.hasuraAlbLogS3 + "-" + Stack.of(this).region);
    //alb.setAttribute("access_logs.s3.bucket",props.hasuraAlbLogS3 + "-" + Stack.of(this).region);

    console.log(props.hostedZone);
    console.log(props.hasuraHostname);

    // Create a load-balanced Fargate service and make it public
    const certificate = new DnsValidatedCertificate(this, "Certificate", {
      hostedZone: props.hostedZone,
      domainName: props.hasuraHostname,
    });

    const fargate = new ApplicationLoadBalancedFargateService(
      this,
      "FargateService",
      {
        vpc: vpc,
        cpu: 256,
        desiredCount: props.multiAz ? 2 : 1,
        taskImageOptions: {
          image: ContainerImage.fromRegistry("hasura/graphql-engine:v2.11.1"),
          containerPort: 8080,
          enableLogging: true,
          environment: {
            HASURA_GRAPHQL_ENABLE_CONSOLE: "true",
            HASURA_GRAPHQL_PG_CONNECTIONS: "100",
            HASURA_GRAPHQL_LOG_LEVEL: "debug",
            HASURA_GRAPHQL_UNAUTHORIZED_ROLE: "guest",

            HASURA_GQL_REMOTE_SCHEMA: props.gql_remote_schema,
          },
          secrets: {
            HASURA_GRAPHQL_DATABASE_URL: ECSSecret.fromSecretsManager(
              hasuraDatabaseUrlSecret
            ),
            HASURA_GRAPHQL_ADMIN_SECRET:
              ECSSecret.fromSecretsManager(hasuraAdminSecret),
            HASURA_GRAPHQL_JWT_SECRET:
              ECSSecret.fromSecretsManager(hasuraJwtSecret),
          },
        },
        memoryLimitMiB: 512,
        loadBalancer: alb,
        certificate: certificate,
        domainName: props.hasuraHostname,
        domainZone: props.hostedZone,
        assignPublicIp: true,
      }
    );

    fargate.targetGroup.configureHealthCheck({
      enabled: true,
      path: "/healthz",
      healthyHttpCodes: "200",
    });

    hasuraDatabase.connections.allowFrom(
      fargate.service,
      new Port({
        protocol: Protocol.TCP,
        stringRepresentation: "Postgres Port",
        fromPort: 5432,
        toPort: 5432,
      })
    );
  }
}
