# Distro-Onboarding-Backend


This project is AWS CDK project for Distro onboarding backend.
This repository contains source code and supporting files for AWS CDK stack that you can deploy with the CDK CLI. It includes the following files and folders.

- bin - Code for entrypoint of the CDK application. 
- lib - Code for the stacks/components that are used by the App.
- src - Code for the application's Lambda function.
- externalDepsLayer - Lambda layer for python packages

The application uses several AWS resources, including Lambda functions, API Gateway, Cognito and its triggers. These resources are defined in the `lib/backend-stack.ts` file in this project. You can update it to add AWS resources through the same deployment process that updates your application code.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project.

### Prerequisites

- git
- node 14+
- npm
- make
- Visual Studio Code (IDE)
- AWS CLI
- AWS CDK
- docker [Install Docker community edition](https://hub.docker.com/search/?type=edition&offering=community)
- SAM CLI [Install the SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)

### Installing

First of all you need to clone this repository:

``` bash
git clone https://github.com/deltamod3/distro-onboarding-backend
```

After clone it, access the folder and you'll need to install packages

```bash
cd distro-onboarding-backend
make init
```

To build CDK project

```bash
make cdk-build
```

To run API endpoint

```bash
make cdk-start-api
```

Sometimes, it occurs permission error to run docker. You can use below command. (Refer [this](https://stackoverflow.com/questions/63065951/aws-sam-build-failed-error-docker-is-unreachable-docker-needs-to-be-running-t) and [this](https://docs.docker.com/engine/install/linux-postinstall/))

```bash
sudo groupadd docker
sudo usermod -aG docker $USER
newgrp docker
```

#### Cognito Local

You can use cognito-local as cognito web service on your local machine.

[Cognito-Local](https://github.com/jagregory/cognito-local)

To run cognito-local

```bash
make cognito-local
```

To check cognito triggers, open another terminal and run lambda functions

```bash
make cdk-start-lambda
```

Open another terminal, and run aws cli cognito-idp commands. You need to login at first.

```bash
make cognito-create-pool pool_name=xxx
```

Save UserPoolId, and run create-user command

```bash
make cognito-create-user pool_id=xxx email=xxx
```

Save UserId, and run confirm-signup command

```bash
make cognito-signup pool_id=xxx user_id=xxx
```
If it can't find the trigger function, check the `template.yaml` file, and make sure the function name is correct as one in the `.coginto/config.json`.

Create UserPoolClient, and save clientId

```bash
make cognito-create-client pool_id=xxx
```

SignIn user

```bash
make cognito-init-auth pool_id=xxx email=xxx password=xxx
```


