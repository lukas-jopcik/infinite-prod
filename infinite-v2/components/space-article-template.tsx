import React from "react";
import Image from "next/image";
import { Calendar, ExternalLink } from "lucide-react";

type ImageBlock = {
  src: string;
  alt: string;
  credit?: string;
};

type FAQItem = {
  question: string;
  answer: string;
};

type SpaceArticleData = {
  headline: string;
  perex: string;
  body: string[];
  subheads?: string[];
  hero: ImageBlock;
  inline?: ImageBlock;
  inline2?: ImageBlock;
  author?: string;
  publishedAt?: string;
  category?: string;
  originalUrl?: string;
  cta?: string;
  faq?: FAQItem[];
};

interface SpaceArticleTemplateProps {
  data: SpaceArticleData;
}

export default function SpaceArticleTemplate({ data }: SpaceArticleTemplateProps) {
  const {
    headline,
    perex,
    body,
    subheads = [],
    hero,
    inline,
    author,
    publishedAt,
    category,
    originalUrl,
    cta = "",
    faq = []
  } = data;


  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("sk-SK", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    }) : "";

  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
      {/* Breadcrumbs / category */}
      {category && (
        <div className="pt-6 text-xs uppercase tracking-widest text-gray-400">
          Vesmírne novinky
        </div>
      )}

      {/* Title */}
      <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-gray-100">
        {headline}
      </h1>

      {/* Meta */}
      <div className="mt-2 text-sm text-gray-400">
        {/* Mobile layout - stacked */}
        <div className="flex flex-col gap-2 sm:hidden">
          <div className="flex items-center gap-3">
            <span>Infinite AI</span>
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              Generované AI
            </span>
          </div>
          <div className="flex items-center gap-3">
            {publishedAt && (
              <time dateTime={publishedAt} className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(publishedAt)}
              </time>
            )}
            {originalUrl && (
              <a 
                href={originalUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Pôvodný článok
              </a>
            )}
          </div>
        </div>
        
        {/* Desktop layout - horizontal */}
        <div className="hidden sm:flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span>Infinite AI</span>
          </span>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
            Generované AI
          </span>
          {publishedAt && (
            <time dateTime={publishedAt} className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(publishedAt)}
            </time>
          )}
          {originalUrl && (
            <a 
              href={originalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Pôvodný článok
            </a>
          )}
        </div>
      </div>

      {/* Hero image */}
      <figure className="mt-6">
        <div className="relative w-full h-64 sm:h-80 lg:h-96 rounded-2xl overflow-hidden shadow-lg">
          <Image
            src={hero.src}
            alt={hero.alt}
            fill
            className="object-cover"
            priority
            quality={75}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 896px"
          />
        </div>
        {hero.credit && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <ExternalLink className="h-4 w-4" />
            <span>Zdroj fotografie: </span>
            <span className="text-accent">{hero.credit}</span>
          </div>
        )}
      </figure>

      {/* Perex */}
      <p className="mt-6 text-lg leading-7 text-gray-200 font-medium">
        {perex}
      </p>

      {/* Body with inline images and subheads */}
      <div className="max-w-none">
        {body.map((paragraph, idx) => (
          <React.Fragment key={idx}>
            {/* Insert subhead before each section */}
            {subheads[idx] && (
              <h2 className="mt-8 text-2xl font-bold text-foreground mb-4">
                {subheads[idx]}
              </h2>
            )}

            <p className="mt-5 text-base leading-7 text-gray-200">
              {paragraph}
            </p>

            {/* Insert first inline image after 2nd paragraph */}
            {inline && idx === 1 && (
              <figure className="my-8">
                <div className="relative w-full h-48 sm:h-64 rounded-xl overflow-hidden shadow-md">
                  <Image
                    src={inline.src}
                    alt={inline.alt}
                    fill
                    className="object-cover"
                    loading="lazy"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
                  />
                </div>
                {inline.credit && (
                  <figcaption className="mt-2 text-xs text-gray-400">
                    {inline.credit}
                  </figcaption>
                )}
              </figure>
            )}

            {/* Insert second inline image after 4th paragraph */}
            {data.inline2 && idx === 3 && (
              <figure className="my-8">
                <div className="relative w-full h-48 sm:h-64 rounded-xl overflow-hidden shadow-md">
                  <Image
                    src={data.inline2.src}
                    alt={data.inline2.alt}
                    fill
                    className="object-cover"
                    loading="lazy"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
                  />
                </div>
                {data.inline2.credit && (
                  <figcaption className="mt-2 text-xs text-gray-400">
                    {data.inline2.credit}
                  </figcaption>
                )}
              </figure>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* FAQ Section */}
      {faq && faq.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-foreground mb-6">Často kladené otázky</h2>
          <div className="space-y-4">
            {faq.map((faqItem, index) => (
              <div key={index} className="border border-border rounded-lg p-6 bg-card/50">
                <h3 className="text-lg font-semibold text-foreground mb-2">{faqItem.question}</h3>
                <p className="text-muted-foreground leading-relaxed">{faqItem.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </article>
  );
}

// Export types for use in other components
export type { SpaceArticleData, ImageBlock, FAQItem };
