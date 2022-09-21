define HELP
Available targets:
    init								Install packages
    login								Refresh AWS credentials
    deploy							Deploy the entire backend stack to aws
  CDK:
    cdk-build						Generate CDK resources
    cdk-clean						Clean CDK resources
    cdk-start-api				Run API endpoints on local
    cdk-start-lambda		Run lambda functions on local
	Cognito:
		cognito-local					Start cognito-local service
		cognito-create-pool		Create new UserPool on cognito-local
		cognito-create-user		Create new user in the cognito-local UserPool
		coginto-signup				Confirm signup user to trigger CognitofnSignupHandler
		cognito-create-client	Create new Client for the UserPool on cognito-local
		cognito-init-auth			User authorization to trigger CognitofnSigninHandler
		cognito-batch			Batch Cognito Command
endef

export HELP

help:
	@echo "$$HELP"

init:
	npm install
	cd src; npm install
	cp src/package.json externalDepsLayer/nodejs
	cd externalDepsLayer/nodejs; npm install

login:
	aws sso login --profile ecometrica

clean:
	make cdk-clean
	make cognito-clean

cdk-clean:
	npm run clean
	rm -rf cdk.out

cdk-build:
	make cdk-clean
	npm run build
	cdk ls

cdk-start-api:
	cdk synth --no-staging > template.yaml
	sam local start-api

cdk-start-lambda:
	cdk synth --no-staging > template.yaml
	sam local start-lambda

cognito-local:
	mkdir .cognito
	cp cognito-local-config.json .cognito/config.json
	npm run cognito-local

cognito-clean:
	rm -rf .cognito

cognito-create-pool:
	aws --endpoint http://localhost:9229 cognito-idp create-user-pool --region local --pool-name $(pool_name)

cognito-create-user:
	aws --endpoint http://localhost:9229 cognito-idp admin-create-user --region local --user-pool-id $(pool_id) --username $(email) --desired-delivery-mediums EMAIL

cognito-signup:
	aws --endpoint http://localhost:9229 cognito-idp admin-confirm-sign-up --region local --user-pool-id $(pool_id) --username $(user_id)

cognito-create-client:
	aws --endpoint http://localhost:9229 cognito-idp create-user-pool-client --region local --user-pool-id $(pool_id) --client-name UserPoolClient

cognito-init-auth:
	aws --endpoint http://localhost:9229 cognito-idp admin-initiate-auth --region local --user-pool-id $(pool_id) --client-id $(client_id) --auth-flow ADMIN_USER_PASSWORD_AUTH --auth-parameters USERNAME=$(email),PASSWORD=$(password)

cognito-batch:
	chmod +x batch-command.sh 
	./batch-command.sh
