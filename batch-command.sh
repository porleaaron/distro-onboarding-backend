#!/bin/bash
#brew install jq
pool_id=$(aws --endpoint http://localhost:9229 cognito-idp create-user-pool --region local --pool-name dev | jq --raw-output ".UserPool.Id")
echo $pool_id
email=porleaaron28@gmail.com
password="testTEST1234@@"
user_id=$(aws --endpoint http://localhost:9229 cognito-idp admin-create-user --region local --user-pool-id $pool_id --username $email --desired-delivery-mediums EMAIL | jq --raw-output ".User.Username")
echo $user_id
aws --endpoint http://localhost:9229 cognito-idp admin-confirm-sign-up --region local --user-pool-id $pool_id --username $user_id

client_id=$(aws --endpoint http://localhost:9229 cognito-idp create-user-pool-client --region local --user-pool-id $pool_id --client-name UserPoolClient | jq --raw-output ".UserPoolClient.ClientId")
echo $client_id
echo $password
aws --endpoint http://localhost:9229 cognito-idp admin-initiate-auth --region local --user-pool-id $pool_id --client-id $client_id --auth-flow ADMIN_USER_PASSWORD_AUTH --auth-parameters USERNAME=$email,PASSWORD=$password