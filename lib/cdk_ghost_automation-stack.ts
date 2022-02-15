import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as rds from '@aws-cdk/aws-rds';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import { bucketName, vpcId, s3CorsRules as cors, ghostDbAdminPassword, ghostDbAdminUser, ghostDbName as databaseName, ghostDbPort, region } from './config';

/**
 * Ghost CDK Automation stack that creates an S3 bucket and a RDS (MySQL) database.
 */
export class CdkGhostAutomationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Creating the s3 bucket
    const s3Bucket = new s3.Bucket(this, 'GhostS3Bucket', {
      cors,
      bucketName,
      enforceSSL: true,
      autoDeleteObjects: true,
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'ghostCloudFrontOAI', {
      comment: 'Allow access to s3'
    });

    const distribution = new cloudfront.Distribution(this, 'ghostS3Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(s3Bucket, { originAccessIdentity }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });
    
    // Creating the RDS (MySQL) database in a VPC (default)
    let vpcOptions: any = { isDefault: true }
    if (vpcId) {
      vpcOptions = { vpcId }
    }
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', vpcOptions);

    // The RDS security group
    const rdsSG = new ec2.SecurityGroup(this, 'RdsSecGrp', {
      vpc,
      securityGroupName: 'GhostSG',
      description: 'SecurityGroup for Ghost RDS instance',
      allowAllOutbound: true
    });
    rdsSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(ghostDbPort), "Allow MySQL access");

    const dbInstance = new rds.DatabaseInstance(this, 'GhostRdsMySQL', {
      databaseName,
      publiclyAccessible: true,
      port: ghostDbPort,
      multiAz: false,
      instanceIdentifier: 'GhostRDSInstance',
      credentials: rds.Credentials.fromPassword(ghostDbAdminUser, cdk.SecretValue.plainText(ghostDbAdminPassword)),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_5_7 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      securityGroups: [rdsSG]
    });

    // Some outputs including the credentials
    new cdk.CfnOutput(this, 's3BucketName', {
      value: bucketName,
    });
    new cdk.CfnOutput(this, 's3BucketRegion', {
      value: region,
    });
    new cdk.CfnOutput(this, 's3AssetHostUrl', {
      value: distribution.domainName,
    });
    new cdk.CfnOutput(this, 'mysqlDatabaseUrl', {
      value: `mysql://${ghostDbAdminUser}:${ghostDbAdminPassword}@${dbInstance.instanceEndpoint.hostname}:${ghostDbPort}/${databaseName}`,
    });
  }
}
