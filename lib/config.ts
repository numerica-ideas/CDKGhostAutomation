/**
 * Config file
 */
import { v4 as uuidv4 } from 'uuid';
import { CorsRule, HttpMethods } from '@aws-cdk/aws-s3';

// Some environment variables
export const vpcId = process.env.CDK_VPC_ID;
export const account: string = process.env.CDK_DEFAULT_ACCOUNT || 'aws-account';
export const region: string = process.env.CDK_DEFAULT_REGION || 'aws-region';

// DB parameters
export const enabledDb: boolean = true;     // Enabling or not the database provisioning
export const ghostDbName: string = 'GhostDB';
export const ghostDbPort: number = 3345;
export const ghostDbAdminUser: string = 'ghost_admin';
export const ghostDbAdminPassword: string = uuidv4();

// S3 parameters: cors rules, bucket name and enabling or not CDN
export const enabledCDN: boolean = false;     // Enabling or not AWS CloudFront distribution
export const bucketName: string = process.env.CDK_DEFAULT_BUCKET_NAME || 's3-ghost-automation';
export const s3CorsRules: CorsRule[] = [
    {
        'allowedHeaders': [
            '*'
        ],
        'allowedMethods': [
          HttpMethods.HEAD,
          HttpMethods.GET,
          HttpMethods.PUT,
          HttpMethods.POST,
          HttpMethods.DELETE
        ],
        'allowedOrigins': [
            '*'
        ],
        'exposedHeaders': []
    }
];
