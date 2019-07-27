import { ACM, Route53 } from "aws-sdk";

export interface ServerlessInstance {
  service: {
    service: string;
    provider: {
      stage: string;
      stackName: string;
      compiledCloudFormationTemplate: {
        Resources: any;
      };
      apiGateway: {
        restApiId: string;
      };
    };
    custom: {
      cfdDomain: {
        domainName: string;
        domainNames: string[];
        cloudFront: string;
        minimumProtocolVersion: string;
      };
    };
  };
  providers: {
    aws: {
      sdk: {
        Route53: typeof Route53;
        CloudFormation: any;
        ACM: typeof ACM;
      };
      getCredentials();
      getRegion();
    };
  };
  cli: {
    log(str: string);
    consoleLog(str: any);
  };
}
