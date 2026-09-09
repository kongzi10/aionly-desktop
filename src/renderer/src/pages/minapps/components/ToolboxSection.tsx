import type { FC, ReactElement } from 'react'
import { useId } from 'react'
import styled from 'styled-components'

interface Props {
  title: string
  children: ReactElement | ReactElement[]
}

const ToolboxSection: FC<Props> = ({ title, children }) => {
  const headingId = useId()

  return (
    <Section>
      <Heading id={headingId}>{title}</Heading>
      <Grid role="list" aria-labelledby={headingId}>
        {(Array.isArray(children) ? children : [children]).map((child, index) => (
          <Item key={child.key ?? `${headingId}-${index}`}>{child}</Item>
        ))}
      </Grid>
    </Section>
  )
}

const Section = styled.section`
  width: 100%;
`

const Heading = styled.h2`
  margin: 0 0 14px;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 600;
`

const Grid = styled.ul`
  display: grid;
  grid-template-columns: repeat(auto-fill, 280px);
  justify-content: start;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
`

const Item = styled.li`
  min-width: 0;
`

export default ToolboxSection
