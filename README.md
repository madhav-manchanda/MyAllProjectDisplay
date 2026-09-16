# My All Project Display

A polished React/Vite showcase for sharing projects as live websites or Android APKs.

## Add a project

Open `src/main.jsx` and add an object to the `projects` array:

```js
{
  id: 'my-project',
  name: 'My Project',
  type: 'Live', // `Live` or `APK`
  description: 'A short description shown on the project card.',
  version: 'Web app',
  url: 'https://my-project.vercel.app',
  apkUrl: '',
  github: 'https://github.com/username/repo',
  featured: false,
}
```

For an Android APK, set `type: 'APK'` and put the downloadable file URL in `apkUrl`.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
