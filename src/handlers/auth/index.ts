import { APIGatewayEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { AttributeType } from "aws-sdk/clients/cognitoidentityserviceprovider";
import { SecretsManager, CognitoIdentityServiceProvider } from "aws-sdk";
import { hasuraUpdate, makeParams, makeUser, User } from "./helper";
const secretsManager = new SecretsManager();

const cognitoProvider = new CognitoIdentityServiceProvider({
  apiVersion: "2016-04-18",
  region: process.env.AWS_REGION,
});

export async function createCognitoUser(
  event: APIGatewayEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const sm = await secretsManager
      .getSecretValue({
        SecretId: `${process.env.appName}-CognitoSecret`,
      })
      .promise();

    const credentials = JSON.parse(sm.SecretString!);
    const userpool_id = credentials.HasuraCognitoUserPool;
    const args = JSON.parse(event.body!).input;

    //note that the param is called input as well, ie input.input for now...
    const poolData = makeParams(userpool_id, args.input.Email);
    const user = await cognitoProvider.adminCreateUser(poolData).promise();
    const user_id = user.User!.Attributes!.find(
      (a: AttributeType) => a?.Name === "sub"
    )!.Value;

    await hasuraUpdate(user_id!, args.input.Role);
    return { statusCode: 200, body: JSON.stringify({ sub: user_id }) };
  } catch (e) {
    console.log(e);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Error:" + e, extension: e }),
    };
  }
}

// special public action that creates a user (never an admin)
export async function createCognitoUserPublic(
  event: APIGatewayEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const sm = await secretsManager
      .getSecretValue({
        SecretId: `${process.env.appName}-CognitoSecret`,
      })
      .promise();

    const credentials = JSON.parse(sm.SecretString!);
    const userpool_id = credentials.HasuraCognitoUserPool;
    const args = JSON.parse(event.body!).input;

    // note that the param is called input as well, ie input.input for now...
    const poolData = makeParams(userpool_id, args.input.Email);
    const user = await cognitoProvider.adminCreateUser(poolData).promise();
    const user_id = user.User!.Attributes!.find(
      (a: AttributeType) => a.Name === "sub"
    )!.Value;
    // hard code site-user
    await hasuraUpdate(user_id!, "site-user");
    return { statusCode: 200, body: JSON.stringify({ sub: user_id }) };
  } catch (e) {
    console.log(e);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Error:" + e, extension: e }),
    };
  }
}

export async function listCognitoUsers(
  event: APIGatewayEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const sm = await secretsManager
      .getSecretValue({
        SecretId: `${process.env.appName}-CognitoSecret`,
      })
      .promise();

    const credentials = JSON.parse(sm.SecretString!);
    const userpool_id = credentials.HasuraCognitoUserPool;
    const args = JSON.parse(event.body!).input;
    console.log(JSON.stringify(args));
    const usersFromCognito = await cognitoProvider
      .listUsers({ UserPoolId: userpool_id })
      .promise();

    const users = usersFromCognito.Users?.map(makeUser);
    return { statusCode: 200, body: JSON.stringify(users) };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Error:" + err, extension: err }),
    };
  }
}

export async function getCognitoUser(
  event: APIGatewayEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const sm = await secretsManager
      .getSecretValue({
        SecretId: `${process.env.appName}-CognitoSecret`,
      })
      .promise();

    const credentials = JSON.parse(sm.SecretString!);
    const userpool_id = credentials.HasuraCognitoUserPool;
    const usersFromCognito = await cognitoProvider
      .listUsers({ UserPoolId: userpool_id })
      .promise();

    const users = usersFromCognito.Users?.map(makeUser);
    const foundUser = users?.find(
      (u: User) => u.UserId === JSON.parse(event.body!).input.userId
    );

    return { statusCode: 200, body: JSON.stringify(foundUser) };
  } catch (e) {
    console.log(e);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Error:" + e, extension: e }),
    };
  }
}

export async function deleteCognitoUser(
  event: APIGatewayEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  try {
    const sm = await secretsManager
      .getSecretValue({
        SecretId: `${process.env.appName}-CognitoSecret`,
      })
      .promise();

    const credentials = JSON.parse(sm.SecretString!);
    const userpool_id = credentials.HasuraCognitoUserPool;
    const args = JSON.parse(event.body!).input;

    await cognitoProvider
      .adminDeleteUser({
        UserPoolId: userpool_id,
        Username: args.username,
      })
      .promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "deleted" }),
    };
  } catch (e) {
    console.log(e);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Error:" + e, extension: e }),
    };
  }
}
