import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as rds from '@aws-cdk/aws-rds';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import * as config from './config';

/**
 * Ghost CDK Automation stack that creates an S3 bucket and a RDS (MySQL) database.
 */
export class CdkGhostAutomationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Creating the s3 bucket
    const s3Bucket = new s3.Bucket(this, 'GhostS3Bucket', {
      cors: config.s3CorsRules,
      bucketName: config.bucketName,
      enforceSSL: true,
      autoDeleteObjects: true,
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Creating a user with full access to the s3 bucket
    const password = `Password-${Date.now()}`;
    const user = new iam.User(this, 'GhostUser', { userName: `ghost-user`, password: cdk.SecretValue.plainText(password) });
    user.addToPolicy(new iam.PolicyStatement({ // Inline policy with access to that bucket, to be used in Ghost settings
      effect: iam.Effect.ALLOW,
      actions: ['s3:*'],
      resources: [s3Bucket.bucketArn],
    }));

    // Generating the user's access key
    const userAccessKey = new iam.CfnAccessKey(this, 'ghostUserAccessKey', { userName: user.userName });

    // User outputs
    new cdk.CfnOutput(this, 'userUsername', { value: user.userName });
    new cdk.CfnOutput(this, 'userPassword', { value: password });
    new cdk.CfnOutput(this, 's3AccessKeyId', { value: userAccessKey.ref });
    new cdk.CfnOutput(this, 's3AccessSecretKey', { value: userAccessKey.attrSecretAccessKey });

    // S3 outputs
    new cdk.CfnOutput(this, 's3BucketName', { value: config.bucketName });
    new cdk.CfnOutput(this, 's3BucketRegion', { value: config.region });

    // CDN distribution configurations with OAI
    if (config.enabledCDN) {
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
      
      new cdk.CfnOutput(this, 's3AssetHostUrl', { value: distribution.domainName });
    }

    if (config.enabledDb) {
      // Creating the RDS (MySQL) database in a VPC (default)
      let vpcOptions: any = { isDefault: true }
      if (config.vpcId) {
        vpcOptions = { vpcId: config.vpcId }
      }
      const vpc = ec2.Vpc.fromLookup(this, 'Vpc', vpcOptions);
  
      // The RDS security group
      const rdsSG = new ec2.SecurityGroup(this, 'RdsSecGrp', {
        vpc,
        securityGroupName: 'GhostSG',
        description: 'SecurityGroup for Ghost RDS instance',
        allowAllOutbound: true
      });
      rdsSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(config.ghostDbPort), 'Allow MySQL access');
  
      const dbInstance = new rds.DatabaseInstance(this, 'GhostRdsMySQL', {
        databaseName: config.ghostDbName,
        publiclyAccessible: true,
        port: config.ghostDbPort,
        multiAz: false,
        instanceIdentifier: 'GhostRDSInstance',
        credentials: rds.Credentials.fromPassword(config.ghostDbAdminUser, cdk.SecretValue.plainText(config.ghostDbAdminPassword)),
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_5_7 }),
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
        vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC
        },
        securityGroups: [rdsSG]
      });
      
      // Add the database connection URL as output
      new cdk.CfnOutput(this, 'mysqlDatabaseUrl', {
        value: `mysql://${config.ghostDbAdminUser}:${config.ghostDbAdminPassword}@${dbInstance.instanceEndpoint.hostname}:${config.ghostDbPort}/${config.ghostDbName}`
      });
    }
  }
}
