declare module "react-simple-maps" {
  import React, { ReactNode, SVGProps } from "react";

  interface GeographyRecord {
    rsmKey: string;
    id: string;
    properties: Record<string, unknown>;
  }

  interface GeographiesProps {
    geography: string | object;
    children: (args: { geographies: GeographyRecord[] }) => ReactNode;
  }

  interface GeographyStyle {
    default?: React.CSSProperties & { outline?: string; fill?: string; cursor?: string };
    hover?: React.CSSProperties & { outline?: string; fill?: string; cursor?: string };
    pressed?: React.CSSProperties & { outline?: string; fill?: string; cursor?: string };
  }

  interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: GeographyRecord;
    style?: GeographyStyle;
  }

  interface ComposableMapProps extends SVGProps<SVGSVGElement> {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
}
