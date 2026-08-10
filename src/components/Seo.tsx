import { Helmet } from "react-helmet-async";

const SITE_URL = "https://compra360app.com.br";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}

/** Metadados por rota (title, description, canonical e og:* autorreferentes). */
const Seo = ({ title, description, path, noindex }: SeoProps) => {
  const url = `${SITE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};

export default Seo;
