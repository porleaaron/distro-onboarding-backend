import { Context } from "aws-lambda";
import { request, gql } from "graphql-request";

const GET_ROLE = gql`
  query ($user_id: uuid!) {
    user_by_pk(id: $user_id) {
      role
    }
  }
`;

type TokenGenerationEvent = {
  request: {
    userAttributes: { [key: string]: string };
    groupConfiguration: [
      {
        groupsToOverride: string[];
        iamRolesToOverride: string[];
        preferredRole: string;
      }
    ];
    clientMetadata: { string: string };
  };
  response: {
    claimsOverrideDetails?: {
      claimsToAddOrOverride?: { [key: string]: string };
      claimsToSuppress?: string[];
      groupOverrideDetails?: {
        groupsToOverride?: string[];
        iamRolesToOverride?: string[];
        preferredRole?: string;
      };
    };
  };
};

/*This is called after a user name and password is provided by user and authenticated in cognito, to generate a JWT containing the valid role of the user*/
export const signinHandler = async (
  event: TokenGenerationEvent,
  _context: Context
) => {
  console.log("SignIn Event", JSON.stringify(event));

  const requestHeaders = {
    "Content-Type": "application/json",
    "x-hasura-admin-secret": process.env.hasuraAdminSecret!,
  };

  const id = event.request.userAttributes.sub!;

  const userRoles = await request({
    url: process.env.hasuraUrl + "/v1/graphql",
    document: GET_ROLE,
    variables: { user_id: id },
    requestHeaders,
  });

  if (!userRoles) throw "No role mapping in user table for user id " + id;

  const tmpRoles = ["guest", userRoles.user_by_pk.role];
  const claims = {
    "x-hasura-user-id": event.request.userAttributes.sub,
    "x-hasura-allowed-roles": tmpRoles,
    "x-hasura-default-role": "site-user",
  };

  event.response = {
    claimsOverrideDetails: {
      claimsToAddOrOverride: {
        "https://hasura.io/jwt/claims": JSON.stringify(claims),
      },
    },
  };

  return event;
};
