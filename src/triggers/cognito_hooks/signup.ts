import { Context } from "aws-lambda";
import { request, gql } from "graphql-request";

const INSERT_USER = gql`
  mutation ($id: uuid, $handle: String, $role: String) {
    insert_user_one(object: { id: $id, handle: $handle, role: $role }) {
      id
    }
  }
`;

type PostConfirmationEvent = {
  triggerSource: string;
  request: {
    userAttributes: { [key: string]: string };
    clientMetadata: { [key: string]: string };
  };
  response: Record<string, never>;
};

type PostConfirmation_ConfirmSignUp_Callback = (
  _: unknown,
  event: PostConfirmationEvent
) => void;

/*This is called *after* a Cognito signup to insert the user. Note it is also invoked by password reset - in which case we do nothing*/
export const signupHandler = async (
  event: PostConfirmationEvent,
  _context: Context,
  callback: PostConfirmation_ConfirmSignUp_Callback
) => {
  console.log("SignUp Event", JSON.stringify(event));
  const requestHeaders = {
    "Content-Type": "application/json",
    "x-hasura-admin-secret": process.env.hasuraAdminSecret!,
  };

  const id = event.request.userAttributes.sub!;
  const handle = event.request.userAttributes["custom:accountId"]!;

  //if trigger is called due to password change, do nothing
  if (event.triggerSource === "PostConfirmation_ConfirmForgotPassword") {
    callback(null, event);
  }

  //if its the first time a user has signed up, create a user record in db
  if (event.triggerSource === "PostConfirmation_ConfirmSignUp") {
    request({
      url: process.env.hasuraUrl + "/v1/graphql",
      document: INSERT_USER,
      variables: { handle, id, role: "site-user" },
      requestHeaders,
    }).then((_data) => {
      callback(null, event);
    });
  }
};
