export const SAMPLE = String.raw`\documentclass{article}
\usepackage{amsmath}
\title{A Short Paper}
\author{Your Name}
\begin{document}
\maketitle

\section{Introduction}
This is a \textbf{draft} written in LibreLeaf. Type as you would in a word
processor. Text in \emph{italics} becomes \verb|\emph|, and \textsc{small caps}
stay small caps.\footnote{Double-click a footnote to edit it.}

Maths such as $E = mc^2$ is kept as LaTeX for now, and so is anything the
editor does not understand yet:

\begin{equation}
  P^2 = \frac{4\pi^2}{G(M+m)} a^3
\end{equation}

\section{Method}
\begin{itemize}
  \item Open a .tex file, or start from this one.
  \item Edit it on the page.
  \item Save it, and it compiles in Overleaf or TeX Live.
\end{itemize}

\end{document}
`;
