#!/usr/bin/env node
import { App } from 'aws-cdk-lib'
import { CdkStack } from '../lib/cdk-stack'
const app = new App()
new CdkStack(app, 'ArtificerToolkitStack', {
  env: {
    account: process.env.AWS_DEFAULT_ACCOUNT,
    region: process.env.AWS_DEFAULT_REGION,
  },
})
