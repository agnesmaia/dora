import "@/shared/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Geist } from "next/font/google";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${geist.variable} antialiased`}>
      <Head>
        <title>Dora — Do Routine Adaptively</title>
        <meta
          name="description"
          content="Assistente de rotina que aprende com você usando Q-Learning"
        />
      </Head>
      <Component {...pageProps} />
    </div>
  );
}
