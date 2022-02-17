#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { account, region } from '../lib/config';
import { CdkGhostAutomationStack } from '../lib/cdk_ghost_automation-stack';

const app = new cdk.App();
new CdkGhostAutomationStack(app, 'CdkGhostAutomationStack', {

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  env: { account, region },

});
