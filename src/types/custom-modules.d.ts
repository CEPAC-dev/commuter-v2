declare module "resend" {
  export class Resend {
    constructor(apiKey?: string);
    emails: { send(opts: any): Promise<any> };
  }
  export default Resend;
}

declare module "nodemailer" {
  const nodemailer: any;
  export default nodemailer;
}

declare module "nodemailer/lib/mailer" {
  const t: any;
  export default t;
}
