import {
  AttributeType,
  UserType,
} from "aws-sdk/clients/cognitoidentityserviceprovider";
import { IncomingMessage } from "http";
import { request } from "https";

const hasuraAdminSecret = process.env.hasuraAdminSecret;
const url = process.env.hasuraUrl;

const upsertUserQuery = `
   mutation ($user_id: uuid, $user_role : String) {
      insert_user_one(object: {user_id: $user_id, role: $user_role}) {
        user_id
        role
      }
 }
`;

export type User = {
  UserName: string;
  UserId: string;
  UserCreateDate: Date;
  UserStatus: string;
  UserLastModifiedDate: Date;
};

export function makeUser(u: UserType): User {
  return {
    UserName: u.Attributes!.find((a: AttributeType) => a.Name === "email")!
      .Value!,
    UserId: u.Attributes!.find((a: AttributeType) => a.Name === "sub")!.Value!,
    UserCreateDate: u.UserCreateDate!,
    UserStatus: u.UserStatus!,
    UserLastModifiedDate: u.UserLastModifiedDate!,
  };
}

export function hasuraUpdate(sub: string, role: string) {
  return new Promise(function (resolve, reject) {
    const graphqlReq = {
      query: upsertUserQuery,
      variables: { user_role: role, user_id: sub },
    };

    const data = JSON.stringify(graphqlReq);

    const options = {
      hostname: url,
      port: 443,
      path: "/v1/graphql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": hasuraAdminSecret,
        "Content-Length": data.length,
      },
    };

    const req = request(options, function (res: IncomingMessage) {
      // reject on bad status
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        const errMsg = res.statusCode
          ? `statusCode=${res.statusCode}`
          : "unknown error";
        return reject(new Error(errMsg));
      }
      // cumulate data
      let body: Array<Uint8Array> = [];
      res.on("data", function (chunk: Uint8Array) {
        body.push(chunk);
      });
      // resolve on end
      res.on("end", function () {
        try {
          body = JSON.parse(Buffer.concat(body).toString());
          console.log(body);
        } catch (e) {
          console.log(JSON.stringify(e));
          reject(e);
        }

        //console.log(body);
        resolve(body);
      });
    });

    // reject on request error
    req.on("error", function (err: Error) {
      reject(err);
    });

    req.write(data);

    // IMPORTANT
    req.end();
  });
}

export function makeParams(cognitoUserpool: string, email: string) {
  return {
    UserPoolId: cognitoUserpool,
    Username: email,
    DesiredDeliveryMediums: ["EMAIL"],
    TemporaryPassword: "Password123$",

    UserAttributes: [
      {
        Name: "email",
        Value: email,
      },

      {
        Name: "phone_number",
        Value: "+447900688301",
      },

      {
        Name: "email_verified",
        Value: "true",
      },
    ],
  };
}
