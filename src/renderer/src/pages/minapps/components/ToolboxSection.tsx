import type { FC, ReactNode } from 'react'
import { Children, isValidElement, useId } from 'react'
import styled from 'styled-components'

type Tone = 'blue' | 'cyan' | 'violet'

interface Props {
  title: string
  children: ReactNode
  tourId?: string
  /** 分区强调色，用于段头标记与计数胶囊 */
  tone?: Tone
  /** 分区内没有任何条目时的提示文案 */
  emptyText?: string
}

const ACCENTS: Record<Tone, { accent: string; halo: string; soft: string }> = {
  blue: { accent: 'rgb(64 128 255)', halo: 'rgb(64 128 255 / 16%)', soft: 'rgb(64 128 255 / 10%)' },
  cyan: { accent: 'rgb(8 179 196)', halo: 'rgb(8 179 196 / 16%)', soft: 'rgb(8 179 196 / 10%)' },
  violet: { accent: 'rgb(139 92 246)', halo: 'rgb(139 92 246 / 16%)', soft: 'rgb(139 92 246 / 10%)' }
}

const ToolboxSection: FC<Props> = ({ title, children, tourId, tone = 'blue', emptyText }) => {
  const headingId = useId()
  const items = Children.toArray(children)

  return (
    <Section data-tour={tourId} $accent={ACCENTS[tone].accent} $halo={ACCENTS[tone].halo} $soft={ACCENTS[tone].soft}>
      <SectionHead>
        <Accent aria-hidden="true" />
        <Heading id={headingId}>{title}</Heading>
        <Count aria-hidden="true">{items.length}</Count>
      </SectionHead>
      <Grid role="list" aria-labelledby={headingId}>
        {items.length > 0 ? (
          items.map((child, index) => (
            <Item key={isValidElement(child) && child.key != null ? child.key : `${headingId}-${index}`}>{child}</Item>
          ))
        ) : (
          <Item>
            <Hint>{emptyText ?? '—'}</Hint>
          </Item>
        )}
      </Grid>
    </Section>
  )
}

const Section = styled.section<{ $accent: string; $halo: string; $soft: string }>`
  --section-accent: ${({ $accent }) => $accent};
  --section-accent-halo: ${({ $halo }) => $halo};
  --section-accent-soft: ${({ $soft }) => $soft};
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  padding: 18px 20px 20px;
  border: 1px solid var(--color-border-soft);
  border-radius: 18px;
  background: var(--color-background-soft);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  body.light & {
    border-color: rgb(132 172 226 / 14%);
    background: rgb(246 249 255 / 58%);
    box-shadow: 0 14px 34px rgb(77 122 190 / 7%);
  }

  body.dark & {
    background: rgb(255 255 255 / 3%);
  }
`

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
`

const Accent = styled.span`
  flex: 0 0 auto;
  width: 3px;
  height: 14px;
  border-radius: 999px;
  background: var(--section-accent);
  box-shadow: 0 0 0 3px var(--section-accent-halo);
`

const Heading = styled.h2`
  overflow: hidden;
  margin: 0;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Count = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--section-accent-soft);
  color: var(--section-accent);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
`

const Grid = styled.ul`
  display: grid;
  /* auto-fill 而非 auto-fit：条目少的分区不会把卡片撑宽，三段的卡片尺寸因此始终一致 */
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  justify-content: start;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Item = styled.li`
  min-width: 0;
`

const Hint = styled.span`
  display: flex;
  align-items: center;
  min-height: 64px;
  padding: 0 4px;
  color: var(--color-text-3);
  font-size: 12.5px;
`

export default ToolboxSection
