import React from 'react';

// Section header with underline rule (Jake's Resume style)
const SectionRule = ({ title, fontSize = 9, fontFamily }) => (
  <div style={{ marginBottom: '2px', marginTop: '6px' }}>
    <div
      style={{
        fontFamily: fontFamily || 'Inter, sans-serif',
        fontWeight: 'bold',
        fontSize: `${fontSize}pt`,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      }}
    >
      {title}
    </div>
    <hr style={{ border: 'none', borderTop: '0.8px solid #111', margin: '2px 0 4px 0' }} />
  </div>
);

/**
 * AtsResumePreview
 *
 * Props:
 *  - resumeData   {object}  Parsed ATS resume JSON
 *  - baseFontSize  {number} Base font size in pt (e.g. 8.5)
 *  - baseFontFamily {string} Selected font family (e.g. 'Lora', 'Inter', 'Roboto')
 *  - innerRef     {React.Ref} forwarded ref for the resume paper div (used by print / pdf)
 */
const parseLinkMarkdownReact = (val, fontFamily) => {
  if (!val) return null;
  const match = val.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (match) {
    const cleanText = match[1].replace(/^https?:\/\/(www\.)?/, '');
    return (
      <a href={match[2]} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', fontFamily }}>
        {cleanText}
      </a>
    );
  }
  let url = val;
  if (!url.startsWith('http') && (url.includes('.com') || url.includes('.org') || url.includes('.me') || url.includes('.in') || url.includes('github.io'))) {
    url = 'https://' + url;
  }
  const cleanText = val.replace(/^https?:\/\/(www\.)?/, '');
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', fontFamily }}>
      {cleanText}
    </a>
  );
};

const AtsResumePreview = ({ resumeData, baseFontSize = 8.5, baseFontFamily = 'Lora', innerRef }) => {
  if (!resumeData) return null;

  const getFontFamilyCSS = (fontName) => {
    switch(fontName) {
      case 'Inter': return '"Inter", sans-serif';
      case 'Roboto': return '"Roboto", sans-serif';
      case 'Merriweather': return '"Merriweather", serif';
      case 'Open Sans': return '"Open Sans", sans-serif';
      case 'EB Garamond': return '"EB Garamond", serif';
      case 'Montserrat': return '"Montserrat", sans-serif';
      case 'Poppins': return '"Poppins", sans-serif';
      case 'Lato': return '"Lato", sans-serif';
      case 'Ubuntu': return '"Ubuntu", sans-serif';
      case 'Nunito': return '"Nunito", sans-serif';
      case 'Raleway': return '"Raleway", sans-serif';
      case 'PT Sans': return '"PT Sans", sans-serif';
      case 'PT Serif': return '"PT Serif", serif';
      case 'Playfair Display': return '"Playfair Display", serif';
      case 'Fira Sans': return '"Fira Sans", sans-serif';
      case 'Oswald': return '"Oswald", sans-serif';
      case 'Lora':
      default:
        return '"Lora", Georgia, serif';
    }
  };

  const isSerif = (fontName) => ['Lora', 'Merriweather', 'EB Garamond', 'PT Serif', 'Playfair Display'].includes(fontName);

  const bodyFontFamily = getFontFamilyCSS(baseFontFamily);
  const nameFontFamily = isSerif(baseFontFamily)
    ? "'Playfair Display', Georgia, serif"
    : bodyFontFamily;
  const headerFontFamily = bodyFontFamily;

  const c = resumeData?.contact || {};
  const contactItems = [];
  if (c?.phone) {
    const cleanPhone = c.phone.replace(/[^0-9]/g, '');
    contactItems.push(
      <a key="phone" href={`https://wa.me/${cleanPhone}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'inherit', fontFamily: headerFontFamily }}>
        <svg viewBox="0 0 24 24" width={`${baseFontSize - 0.5}pt`} height={`${baseFontSize - 0.5}pt`} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '1px' }}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
        {c?.phone}
      </a>
    );
  }
  if (c?.email) {
    contactItems.push(
      <a key="email" href={`mailto:${c.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'inherit', fontFamily: headerFontFamily }}>
        <svg viewBox="0 0 24 24" width={`${baseFontSize - 0.5}pt`} height={`${baseFontSize - 0.5}pt`} stroke="currentColor" stroke-width="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '1px' }}>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
        {c?.email}
      </a>
    );
  }
  if (c?.linkedin) {
    contactItems.push(
      <span key="linkedin" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: headerFontFamily }}>
        <svg viewBox="0 0 24 24" width={`${baseFontSize - 0.5}pt`} height={`${baseFontSize - 0.5}pt`} stroke="currentColor" stroke-width="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '1px' }}>
          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
          <rect x="2" y="9" width="4" height="12" />
          <circle cx="4" cy="4" r="2" />
        </svg>
        {parseLinkMarkdownReact(c?.linkedin, headerFontFamily)}
      </span>
    );
  }
  if (c?.github) {
    contactItems.push(
      <span key="github" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: headerFontFamily }}>
        <svg viewBox="0 0 24 24" width={`${baseFontSize - 0.5}pt`} height={`${baseFontSize - 0.5}pt`} stroke="currentColor" stroke-width="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '1px' }}>
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
        {parseLinkMarkdownReact(c?.github, headerFontFamily)}
      </span>
    );
  }
  if (c?.portfolio) {
    contactItems.push(
      <span key="portfolio" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: headerFontFamily }}>
        <svg viewBox="0 0 24 24" width={`${baseFontSize - 0.5}pt`} height={`${baseFontSize - 0.5}pt`} stroke="currentColor" stroke-width="2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '1px' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {parseLinkMarkdownReact(c?.portfolio, headerFontFamily)}
      </span>
    );
  }

  if (c?.codingprofile) {
    contactItems.push(
      <span
        key="codingprofile"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontFamily: headerFontFamily,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width={`${baseFontSize - 0.5}pt`}
          height={`${baseFontSize - 0.5}pt`}
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: '1px' }}
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>

        {parseLinkMarkdownReact(c?.codingprofile, headerFontFamily)}
      </span>
    );
  }

  return (
    <div
      ref={innerRef}
      className="border border-gray-200 shadow-md print:border-none print:shadow-none"
      style={{
        fontFamily: bodyFontFamily,
        fontSize: `${baseFontSize}pt`,
        lineHeight: 1.25,
        color: '#111',
        background: '#fff',
        padding: '36px 48px',
        width: '210mm',
        minHeight: '297mm',
        boxSizing: 'border-box',
      }}
    >
      {/* Load Google Fonts Dynamically */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&family=Lato:ital,wght@0,300;0,400;0,700;1,300;1,400&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300&family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Ubuntu:wght@400;500;700&family=Nunito:wght@400;500;700&family=Raleway:wght@400;500;700&family=PT+Sans:wght@400;700&family=PT+Serif:wght@400;700&family=Fira+Sans:wght@400;500;700&family=Oswald:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Name */}
      <div style={{ textAlign: 'center', marginBottom: '2px' }}>
        <span
          style={{
            fontSize: `${baseFontSize * 2.1}pt`,
            fontWeight: 'bold',
            fontFamily: nameFontFamily,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}
        >
          {resumeData?.name}
        </span>
      </div>

      {/* Contact */}
      {contactItems.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px',
            fontSize: `${baseFontSize - 0.5}pt`,
            fontFamily: headerFontFamily,
            color: '#444',
            marginBottom: '8px',
          }}
        >
          {contactItems.reduce((acc, item, index) => {
            if (index > 0) {
              acc.push(
                <span key={`sep-${index}`} style={{ color: '#ccc', margin: '0 2px' }}>
                  |
                </span>
              );
            }
            acc.push(item);
            return acc;
          }, [])}
        </div>
      )}

      {/* Summary */}
      {resumeData?.summary && (
        <>
          <SectionRule title="Summary" fontSize={baseFontSize + 0.5} fontFamily={headerFontFamily} />
          <p style={{ fontSize: `${baseFontSize}pt`, marginBottom: '6px', textAlign: 'justify' }}>
            {resumeData?.summary}
          </p>
        </>
      )}

      {/* Skills */}
      {resumeData?.skills?.length > 0 && (
        <>
          <SectionRule title="Technical Skills" fontSize={baseFontSize + 0.5} fontFamily={headerFontFamily} />
          <div style={{ marginBottom: '6px' }}>
            {resumeData?.skills?.map((s, i) => (
              <div key={i} style={{ fontSize: `${baseFontSize}pt`, marginBottom: '2px' }}>
                <strong>{s?.category}:</strong> {s?.items}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Experience */}
      {resumeData?.experience?.length > 0 && (
        <>
          <SectionRule title="Experience" fontSize={baseFontSize + 0.5} fontFamily={headerFontFamily} />
          {resumeData?.experience?.map((exp, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 'bold',
                  fontSize: `${baseFontSize}pt`,
                }}
              >
                <span>{exp?.company}</span>
                <span style={{ fontWeight: 'normal', fontSize: `${baseFontSize - 0.5}pt` }}>
                  {exp?.dates}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontStyle: 'italic',
                  fontSize: `${baseFontSize - 0.5}pt`,
                  marginBottom: '2px',
                }}
              >
                <span>{exp?.role}</span>
                <span>{exp?.location}</span>
              </div>
              {exp?.bullets?.map((b, j) => (
                <div key={j} style={{ fontSize: `${baseFontSize - 0.5}pt`, paddingLeft: '12px' }}>
                  • {b}
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* Projects */}
      {resumeData?.projects?.length > 0 && (
        <>
          <SectionRule title="Projects" fontSize={baseFontSize + 0.5} fontFamily={headerFontFamily} />
          {resumeData?.projects?.map((proj, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 'bold',
                  fontSize: `${baseFontSize}pt`,
                  marginBottom: '1px',
                }}
              >
                <span>
                  {proj?.name}
                  {proj?.github && (
                    <>
                      <span style={{ fontWeight: 'normal', color: '#ccc', margin: '0 4px' }}>|</span>
                      <a
                        href={proj?.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontWeight: 'normal',
                          fontSize: `${baseFontSize - 0.5}pt`,
                          color: '#6b21a8',
                          textDecoration: 'underline',
                        }}
                      >
                        GitHub
                      </a>
                    </>
                  )}
                  {proj?.liveLink && (
                    <>
                      <span style={{ fontWeight: 'normal', color: '#ccc', margin: '0 4px' }}>|</span>
                      <a
                        href={proj?.liveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontWeight: 'normal',
                          fontSize: `${baseFontSize - 0.5}pt`,
                          color: '#6b21a8',
                          textDecoration: 'underline',
                        }}
                      >
                        Live Link
                      </a>
                    </>
                  )}
                </span>
                <span style={{ fontWeight: 'normal', fontSize: `${baseFontSize - 0.5}pt` }}>
                  {proj?.technologies}
                </span>
              </div>
              {proj?.bullets?.map((b, j) => (
                <div key={j} style={{ fontSize: `${baseFontSize - 0.5}pt`, paddingLeft: '12px' }}>
                  • {b}
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* Achievements */}
      {resumeData?.achievements?.length > 0 && (
        <>
          <SectionRule title="Achievements" fontSize={baseFontSize + 0.5} fontFamily={headerFontFamily} />
          <div style={{ marginBottom: '6px' }}>
            {resumeData?.achievements?.map((a, i) => (
              <div key={i} style={{ fontSize: `${baseFontSize - 0.5}pt`, paddingLeft: '12px' }}>
                • {a}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Education */}
      {resumeData?.education?.length > 0 && (
        <>
          <SectionRule title="Education" fontSize={baseFontSize + 0.5} fontFamily={headerFontFamily} />

          {resumeData?.education?.map((edu, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 'bold',
                  fontSize: `${baseFontSize}pt`,
                }}
              >
                <span>{edu?.institution}</span>

                <span
                  style={{
                    fontWeight: 'normal',
                    fontSize: `${baseFontSize - 0.5}pt`,
                  }}
                >
                  {edu?.dates}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontStyle: 'italic',
                  fontSize: `${baseFontSize - 0.5}pt`,
                }}
              >
                <span>{edu?.degree}</span>
                <span>{edu?.location}</span>
              </div>

            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default AtsResumePreview;
