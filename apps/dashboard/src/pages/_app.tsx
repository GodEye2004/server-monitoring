import type { AppProps } from 'next/app';
import Head from 'next/head';
import { AuthProvider } from '../lib/auth-context';
import './styles.scss';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <title>Server Monitor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
