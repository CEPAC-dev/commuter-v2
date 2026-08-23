declare module "resend" {
  export class Resend {
    constructor(apiKey?: string);
    emails: { send(opts: unknown): Promise<unknown> };
  }
  export default Resend;
}

declare module "nodemailer" {
  const nodemailer: unknown;
  export default nodemailer;
}

declare module "nodemailer/lib/mailer" {
  const t: unknown;
  export default t;
}
