## Installation

1. Clone the repository:

```bash
git clone [https://github.com/realdezzy/heic2png](https://github.com/realdezzy/heic2png)
```

2. Install dependencies:

```bash
npm i
```

3. Configure environment variables:

```bash
cp .env.example .env
```

4. Update `.env` with your credentials:

```env
VITE_KEY=Your_cere_json_password
```

5. Start the development server:

```bash
npm dev
```

## Usage

1. Visit the application URL
2. Click "Upload File" to select a HEIC file
3. Upload the file to Cere Network DDC
4. Click "Convert to PNG" to process the image
5. Once converted, use the provided link to download or share the PNG file

## Dependencies

### Dependencies

- "@acurast/cli": "^0.1.5",
- "@cere-ddc-sdk/ddc-client": "^2.13.0",
- "react": "^18.3.1",
- "react-dom": "^18.3.1",
- "react-hot-toast": "^2.4.1"
