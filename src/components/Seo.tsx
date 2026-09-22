import { Helmet } from "react-helmet-async";

const SITE_URL = "https://compra360app.com.br";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  /** Caminho absoluto no site (ex.: /og-rede-fornecedores.jpg) para a prévia de compartilhamento. */
  image?: string;
  imageAlt?: string;
}

/** Metadados por rota (title, description, canonical e og:* autorreferentes). */
const Seo = ({ title, description, path, noindex, image, imageAlt }: SeoProps) => {
  const url = `${SITE_URL}${path}`;
  const imageUrl = image ? `${SITE_URL}${image}` : null;
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
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      {imageUrl && <meta property="og:image:secure_url" content={imageUrl} />}
      {imageUrl && <meta property="og:image:width" content="1200" />}
      {imageUrl && <meta property="og:image:height" content="630" />}
      {imageUrl && <meta property="og:image:alt" content={imageAlt || title} />}
      {imageUrl && <meta name="twitter:image" content={imageUrl} />}
      {imageUrl && <meta name="twitter:card" content="summary_large_image" />}
    </Helmet>
  );
};

export default Seo;
