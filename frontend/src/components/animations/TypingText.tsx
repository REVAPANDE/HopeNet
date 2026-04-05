import { useEffect, useState } from "react";

export function TypingText(props: {
  text: string;
  speed?: number;
  renderText?: (text: string) => string;
}) {
  const [visibleText, setVisibleText] = useState("");
  const speed = props.speed ?? 14;

  useEffect(() => {
    setVisibleText("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(props.text.slice(0, index));
      if (index >= props.text.length) {
        window.clearInterval(timer);
      }
    }, speed);

    return () => window.clearInterval(timer);
  }, [props.text, speed]);

  if (props.renderText) {
    return <span dangerouslySetInnerHTML={{ __html: props.renderText(visibleText) }} />;
  }

  return <span>{visibleText}</span>;
}
