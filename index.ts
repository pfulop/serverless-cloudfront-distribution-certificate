import * as aws from "aws-sdk";
import { Route53 } from "aws-sdk";
import { Arn } from "aws-sdk/clients/acm";
import { ServerlessInstance } from "./ServerlessInstance";
import { ServerlessOptions } from "./ServerlessOptions";

interface IHooks {
  "aws:package:finalize:mergeCustomProviderResources": () => void;
}

class ServerlessCloudfrontDistributionCertificate {
  private serverless: ServerlessInstance;
  private options: ServerlessOptions;
  private domain: string;
  private cerArn: Arn;
  private acm: aws.ACM;
  private route53: aws.Route53;

  private hooks: IHooks;

  constructor(serverless: ServerlessInstance, options: ServerlessOptions) {
    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      "aws:package:finalize:mergeCustomProviderResources": this.assignCert,
    };

    this.domain = serverless.service.custom.cfdDomain.domainName;
  }

  // public initializeVariables() {
  //   const credentials = this.serverless.providers.aws.getCredentials();

  //   this.givenDomainName = this.serverless.service.custom.customDomain.domainName;
  //   this.hostedZonePrivate = this.serverless.service.custom.customDomain.hostedZonePrivate;
  //   let basePath = this.serverless.service.custom.customDomain.basePath;
  //   if (basePath == null || basePath.trim() === "") {
  //     basePath = "(none)";
  //   }
  //   this.basePath = basePath;
  //   let stage = this.serverless.service.custom.customDomain.stage;
  //   if (typeof stage === "undefined") {
  //     stage = this.options.stage || this.serverless.service.provider.stage;
  //   }
  //   this.stage = stage;

  //   const endpointTypeWithDefault =
  //     this.serverless.service.custom.customDomain.endpointType ||
  //     endpointTypes.edge;
  //   const endpointTypeToUse =
  //     endpointTypes[endpointTypeWithDefault.toLowerCase()];
  //   if (!endpointTypeToUse) {
  //     throw new Error(
  //       `${endpointTypeWithDefault} is not supported endpointType, use edge or regional.`,
  //     );
  //   }
  //   this.endpointType = endpointTypeToUse;

  //   this.acmRegion =
  //     this.endpointType === endpointTypes.regional
  //       ? this.serverless.providers.aws.getRegion()
  //       : "us-east-1";
  //   const acmCredentials = Object.assign({}, credentials, {
  //     region: this.acmRegion,
  //   });
  //   this.acm = new this.serverless.providers.aws.sdk.ACM(acmCredentials);
  // }

  private assignCert() {
    this.createCert();
  }

  private async checkAndCreateRoute53Entry() {
    const certificate = await this.acm
      .describeCertificate({ CertificateArn: this.cerArn })
      .promise();

    if (certificate.Certificate.Status !== "PENDING_VALIDATION") {
      this.serverless.cli.log(`Certificate cannot be validated`);
      return;
    }

    const validations = certificate.Certificate.DomainValidationOptions.filter(
      ({ ValidationStatus, ValidationMethod }) =>
        ValidationStatus === "PENDING_VALIDATION" && ValidationMethod === "DNS",
    );

    const credentials = this.serverless.providers.aws.getCredentials();
    this.route53 = new this.serverless.providers.aws.sdk.Route53(credentials);

    await validations.forEach(async (validation) => {
      this.serverless.cli.log(`Validating certificate`);
      const hostedZone = await this.findHostedZoneId(
        validation.ResourceRecord.Name,
      );
      if (!hostedZone) {
        throw new Error(`Can't find hostedzone`);
      }

      const params: Route53.ChangeResourceRecordSetsRequest = {
        ChangeBatch: {
          Changes: [
            {
              Action: "UPSERT",
              ResourceRecordSet: {
                Name: validation.ResourceRecord.Name,
                ResourceRecords: [
                  {
                    Value: validation.ResourceRecord.Value,
                  },
                ],
                Type: validation.ResourceRecord.Type,
              },
            },
          ],
          Comment:
            "Record created by serverless-cloudfront-distribution-certificate",
        },
        HostedZoneId: hostedZone.Id,
      };
      await this.route53.changeResourceRecordSets(params).promise();
    });
  }

  private async findHostedZoneId(domain: string) {
    this.serverless.cli.log(`Getting hosted zone id`);
    const zones = await this.route53.listHostedZones({}).promise();
    const domainNameReverse = domain.split(".").reverse();
    const targetHostedZone = zones.HostedZones.filter((hostedZone) => {
      const zoneName = hostedZone.Name.replace(/\.$/, "");
      const hostedZoneNameReverse = zoneName.split(".").reverse();

      if (
        domainNameReverse.length === 1 ||
        domainNameReverse.length >= hostedZoneNameReverse.length
      ) {
        return !hostedZoneNameReverse.some(
          (n, i) => n !== domainNameReverse[i],
        );
      }
      return false;
    })
      .sort((zone1, zone2) => zone2.Name.length - zone1.Name.length)
      .shift();

    return targetHostedZone;
  }

  private async createCert() {
    if (!this.domain) {
      this.serverless.cli.log(`No domain specified skipping`);
      return;
    }
    const credentials = this.serverless.providers.aws.getCredentials();
    this.acm = new this.serverless.providers.aws.sdk.ACM(credentials);
    const statuses = ["PENDING_VALIDATION", "ISSUED", "INACTIVE"];
    const certData = await this.acm
      .listCertificates({ CertificateStatuses: statuses })
      .promise();

    const certificate = certData.CertificateSummaryList.find(
      (cer) => cer.DomainName === this.domain,
    );

    if (certificate) {
      this.serverless.cli.log(`Found existing certificate`);
      this.cerArn = certificate.CertificateArn;
    } else {
      const cerArn = await this.acm
        .requestCertificate({
          DomainName: this.domain,
          DomainValidationOptions: [
            {
              DomainName: this.domain,
              ValidationDomain: this.domain,
            },
          ],
          ValidationMethod: "DNS",
        })
        .promise();
      if (typeof cerArn === "string") {
        this.serverless.cli.log(`Certificate created`);
        this.cerArn = cerArn;
      }
    }
    if (!this.cerArn) {
      throw new Error("Something went wrong");
    } else {
      await this.checkAndCreateRoute53Entry();
    }
  }
}

export { ServerlessCloudfrontDistributionCertificate };
