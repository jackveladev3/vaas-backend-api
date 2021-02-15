# Video Lecture API

## Requirements

### Language

| language   | version |
| ---------- | ------- |
| node       | ^12.0.0 |
| TypeScript | ^4.0.2  |

### DevOps tools

| tool                 | version |
| -------------------- | ------- |
| Serverless Framework | ^1.73.0 |

#### Usage

To use this repo locally you need to have the [Serverless framework](https://serverless.com) installed.

```bash
$ npm install serverless -g
```

Clone this repo.

```bash
$ git clone https://github.com/prd-inc/vaas-backend-api.git
```

Go to one of the services in the `services/` dir.

Invoke API Locally

```bash
$ IS_LOCAL=true serverless invoke local -f get --path events/get-event.json
```

Invoke API GateWay Locally

```bash
curl --header "cognito-authentication-provider:

cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-

1_Jw6lUuyG2,cognito-idp.ap-northeast-1.amazonaws.com/ap-

northeast-1_Jw6lUuyG2:CognitoSignIn:5f24dbc9-d3ab-4bce-8d5f-

eafaeced67ff" \

http://localhost:3000/GetLectures
```

And run this to deploy to your AWS account.

```bash
$ serverless deploy:[dev|test|prod]
or
npm run serverless_deploy
```

Deploy single Lambda Function

```bash
serverless deploy -f getData
```

Deploy One Lambda Function Which is internally connected with other API

```bash
serverless deploy -s GetLectures
```

The services are dependent on the resources that are created [in this accompanying repo](https://github.com/prd-inc/vaas-backend-resources.git).
