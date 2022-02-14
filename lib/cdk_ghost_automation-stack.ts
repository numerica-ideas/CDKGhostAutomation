import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as rds from '@aws-cdk/aws-rds';
import * as ec2 from '@aws-cdk/aws-ec2'
import { bucketName, vpcId, s3CorsRules as cors, ghostDbAdminPassword, ghostDbAdminUser, ghostDbName as databaseName } from './config';

/**
 * Ghost CDK Automation stack that creates an S3 bucket and a RDS (MySQL) database.
 */
export class CdkGhostAutomationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Creating the s3 bucket
    new s3.Bucket(this, 'GhostS3Bucket', {
      cors,
      bucketName,
      enforceSSL: true,
      autoDeleteObjects: true,
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    
    // Creating the RDS (MySQL) database in a VPC (default)
    let vpcOptions: any = { isDefault: true }
    if (vpcId) {
      vpcOptions = { vpcId }
    }
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', vpcOptions);

    const dbInstance = new rds.DatabaseInstance(this, 'GhostRdsMySQL', {
      databaseName,
      publiclyAccessible: true,
      multiAz: false,
      instanceIdentifier: 'GhostRDSInstance',
      credentials: rds.Credentials.fromPassword(ghostDbAdminUser, cdk.SecretValue.plainText(ghostDbAdminPassword)),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_5_7 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      }
    });

    // Some outputs including the credentials
    new cdk.CfnOutput(this, 'ghostBucketName', {
      value: bucketName,
    });
    new cdk.CfnOutput(this, 'ghostDbName', {
      value: databaseName,
    });
    new cdk.CfnOutput(this, 'ghostDbEndpoint', {
      value: dbInstance.instanceEndpoint.hostname,
    });
    new cdk.CfnOutput(this, 'ghostDbAdminUser', {
      value: ghostDbAdminUser!,
    });
    new cdk.CfnOutput(this, 'ghostDbAdminPassword', {
      value: ghostDbAdminPassword!,
    });
  }
}
