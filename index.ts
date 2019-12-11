import * as aws from "aws-sdk";
import { Route53 } from "aws-sdk";
import { Arn } from "aws-sdk/clients/acm";
import { ServerlessInstance } from "./ServerlessInstance";
import { ServerlessOptions } from "./ServerlessOptions";

interface IHooks {
  "aws:package:finalize:mergeCustomProviderResources": () => void;
}
type HostedZonesResult = {
  Name: string,
  Id: string,
}
class ServerlessCloudfrontDistributionCertificate {
  private serverless: ServerlessInstance;
  private options: ServerlessOptions;
  private domains: string[];
  private cerArn: Arn;
  private minProtocolVersion: string;
  private acm: aws.ACM;
  private route53: aws.Route53;
  private cloudFront: string;
  private validationChecks: number = 15;

  private hooks: IHooks;

  constructor(serverless: ServerlessInstance, options: ServerlessOptions) {
    this.serverless = serverless;
    this.options = options;

    this.waitForCertificateToBecomeValid = this.waitForCertificateToBecomeValid.bind(
      this,
    );

    this.hooks = {
      "aws:package:finalize:mergeCustomProviderResources": this.assignCert.bind(
        this,
      ),
    };
  }

  private async assignCert() {
    if (Array.isArray(this.serverless.service.custom.cfdDomain.domainNames)) {
      this.serverless.cli.log(`Multiple domains specified`);
      this.domains = this.serverless.service.custom.cfdDomain.domainNames;
    } else {
      this.domains = [this.serverless.service.custom.cfdDomain.domainName];
    }

    this.cloudFront = this.serverless.service.custom.cfdDomain.cloudFront;
    this.minProtocolVersion = this.serverless.service.custom.cfdDomain.minimumProtocolVersion;

    await this.createCert();

    if (!this.cerArn) {
      throw new Error("Something went wrong");
    } else {
      await this.checkAndCreateRoute53Entry();
    }
    this.modifyCloudformation();
    this.validationChecks =
      this.serverless.service.custom.cfdDomain.retries || 15;
    await this.waitForCertificateToBecomeValid();
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForCertificateToBecomeValid() {
    const cert = await this.acm
      .describeCertificate({ CertificateArn: this.cerArn })
      .promise();
    this.serverless.cli.log(cert.Certificate.Status);

    if (
      cert.Certificate.Status === "PENDING_VALIDATION" &&
      this.validationChecks > 0
    ) {
      this.validationChecks -= 1;
      await this.delay(60000).then(this.waitForCertificateToBecomeValid);
    } else if (cert.Certificate.Status === "ISSUED") {
      this.serverless.cli.log(`Certificate is valid`);
    } else {
      throw new Error("Certificate is not valid after 15 minutes.");
    }
  }

  private async checkAndCreateRoute53Entry() {
    let validations = [];
    const retries = this.serverless.service.custom.cfdDomain.retries || 31;
    let tries = 0;
    do {
      await this.delay(2000);
      this.serverless.cli.log(`Looking for validation resource records...`);
      const certificate = await this.acm
        .describeCertificate({ CertificateArn: this.cerArn })
        .promise();

      if (certificate.Certificate.Status === "ISSUED") {
        this.serverless.cli.log(`Certificate has been validated before`);
        return;
      }
      if (certificate.Certificate.Status !== "PENDING_VALIDATION") {
        return;
      }

      validations = certificate.Certificate.DomainValidationOptions.filter(
        ({ ValidationStatus, ValidationMethod, ResourceRecord }) =>
          ValidationStatus === "PENDING_VALIDATION" &&
          ValidationMethod === "DNS" &&
          ResourceRecord !== undefined,
      );
      if (validations.length !== this.domains.length) {
        this.serverless.cli.log(`Validation resource records not found!`);
        tries++;
      }
    } while (validations.length !== this.domains.length && tries < retries);

    if (validations.length !== this.domains.length) {
      throw new Error(
        `Timed out waiting for validation resource records to be assigned!`,
      );
    }

    const credentials = this.serverless.providers.aws.getCredentials();
    this.route53 = new this.serverless.providers.aws.sdk.Route53(credentials);

    const validationPromises = validations.map(async (validation) => {
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
                TTL: 60,
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
      this.serverless.cli.log("Created resource recordset");
    });
    await Promise.all(validationPromises);
  }
  private async getHostedZones() {
    return await new Promise<Array<HostedZonesResult>>((success, failure) => {
      const zones = [];
      const getZones = (marker: string) => {
        this.route53.listHostedZones({
          Marker: marker === "" ? undefined : marker,
          MaxItems: "100",
        }, (err, data) => {
          if (err) {
            return failure(err);
          }
          data.HostedZones.forEach((zone) => {
            zones.push(zone);
          })
          if (data.IsTruncated) {
            return getZones(data.Marker);
          }
          success(zones);
        });
      };
      getZones("");
    });
  }
  private async findHostedZoneId(domain: string) {
    this.serverless.cli.log(`Getting hosted zone id`);
    const zones = await this.getHostedZones();
    const domainNameReverse = domain
      .replace(/\.$/, "")
      .split(".")
      .reverse();
    const targetHostedZone = zones.filter((hostedZone) => {
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
    if (!this.domains || this.domains.length < 1) {
      this.serverless.cli.log(`No domain specified skipping`);
      return;
    }
    const credentials = this.serverless.providers.aws.getCredentials();
    const acmCredentials = Object.assign({}, credentials, {
      region: "us-east-1",
    });
    this.acm = new this.serverless.providers.aws.sdk.ACM(acmCredentials);
    const statuses = ["PENDING_VALIDATION", "ISSUED", "INACTIVE"];
    const certData = await this.acm
      .listCertificates({ CertificateStatuses: statuses })
      .promise();

    const domain = this.domains[0];
    const alternativeNames = this.domains.slice(1);

    const certificates = certData.CertificateSummaryList.filter(
      (cer) => cer.DomainName === domain,
    );

    let certificate = null;

    if (certificates.length > 0) {
      const certificateDetailPromises = certificates.map((currentCertificate) =>
        this.acm
          .describeCertificate({
            CertificateArn: currentCertificate.CertificateArn,
          })
          .promise(),
      );
      const certificateDetails = await Promise.all(certificateDetailPromises);
      certificate = certificateDetails.find((certificateDetail) => {
        const alternativeNamesSet = new Set(
          certificateDetail.Certificate.SubjectAlternativeNames,
        );
        this.serverless.cli.log(
          `Checking: ${certificateDetail.Certificate.DomainName}`,
        );

        return !alternativeNames.some((aN) => !alternativeNamesSet.has(aN));
      });
    }

    if (certificate) {
      this.serverless.cli.log(
        `Found existing certificate: ${certificate.Certificate.CertificateArn}`,
      );
      this.cerArn = certificate.Certificate.CertificateArn;
    } else {
      this.serverless.cli.log("requesting certificate");
      const certParams = {
        DomainName: domain,
        DomainValidationOptions: [
          {
            DomainName: domain,
            ValidationDomain: domain,
          },
        ],
        SubjectAlternativeNames: alternativeNames,
        ValidationMethod: "DNS",
      };
      if (alternativeNames.length < 1) {
        delete certParams.SubjectAlternativeNames;
      }
      const cerArn = await this.acm.requestCertificate(certParams).promise();
      if (cerArn.CertificateArn) {
        this.serverless.cli.log(`Certificate created`);
        this.cerArn = cerArn.CertificateArn;
      }
    }
  }

  private modifyCloudformation() {
    const template = this.serverless.service.provider
      .compiledCloudFormationTemplate;

    template.Resources[
      this.cloudFront
    ].Properties.DistributionConfig.ViewerCertificate = {
      AcmCertificateArn: this.cerArn,
      SslSupportMethod: "sni-only",
    };

    if (this.minProtocolVersion) {
      template.Resources[
        this.cloudFront
      ].Properties.DistributionConfig
        .ViewerCertificate.MinimumProtocolVersion = this.minProtocolVersion;
    }
  }
}

export = ServerlessCloudfrontDistributionCertificate;
