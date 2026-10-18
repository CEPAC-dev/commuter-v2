This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## API usage (dev)

When calling API routes from Windows PowerShell or CMD, ensure JSON quotes preserved.

- PowerShell (recommended):

```powershell
curl.exe -v -X POST "http://localhost:3000/api/auth/signUpDriver" -H "Content-Type: application/json" -d '{ "name": "Test Driver", "phone": "+201000000000", "password": "password123", "email": "test@example.com", "gender": "male" }'
```

- CMD (escape inner quotes):

```cmd
curl -v -X POST "http://localhost:3000/api/auth/signUpDriver" -H "Content-Type: application/json" -d "{\"name\":\"Test Driver\",\"phone\":\"+201000000000\",\"password\":\"password123\",\"email\":\"test@example.com\",\"gender\":\"male\"}"
```

- Bash / WSL / macOS:

```bash
curl -v -X POST http://localhost:3000/api/auth/signUpDriver -H "Content-Type: application/json" -d '{"name":"Test Driver","phone":"+201000000000","password":"password123","email":"test@example.com","gender":"male"}'
```

Notes: If server logs invalid JSON like `{name:Test Driver,...}` your shell stripped quotes; use examples above or use Node script `scripts/test_signUpDriver.js` or Postman.
