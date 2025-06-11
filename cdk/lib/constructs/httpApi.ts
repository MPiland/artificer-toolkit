#!/usr/bin/env node
import { CfnOutput, Duration } from 'aws-cdk-lib'
import { CorsHttpMethod, HttpApi } from 'aws-cdk-lib/aws-apigatewayv2'
import { Construct } from 'constructs'

export class HttpApiConstruct extends Construct {
  readonly httpApi: HttpApi
  constructor(scope: Construct, id: string) {
    super(scope, id)

    this.httpApi = new HttpApi(this, id, {
      corsPreflight: {
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
        allowMethods: [
          CorsHttpMethod.OPTIONS,
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE,
        ],
        allowOrigins: ['*'], // In production, you should restrict this to your domain
        maxAge: Duration.days(1),
      },
    })

    new CfnOutput(this, 'HttpApiUrl', {
      value: this.httpApi.apiEndpoint,
    })
  }
}
