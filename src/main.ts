import * as github from '@actions/github'
import axios from 'axios'
import { formatEvent } from './format'
import { getInputs, Inputs, statusOpts } from './input'
import { logError, logInfo } from './utils'
import { fitEmbed } from './validate'

async function run() {
    try {
        const inputs = getInputs()
        const payload = getPayload(inputs)
        await Promise.all(inputs.webhooks.map(w => wrapWebhook(w.trim(), payload)))
    } catch(e) {
        logError(e.message)
    }
}

function wrapWebhook(webhook: string, payload: Object): Promise<void> {
    return async function() {
        try {
            await axios.post(webhook, payload)
        } catch(e) {
            if (e.response) {
                logError(`${e.response.status}: ${JSON.stringify(e.response.data)}`)
            } else {
                logError(e)
            }
        }
    }()
}

export function getPayload(inputs: Inputs): Object {
    const ctx = github.context
    const { owner, repo } = ctx.repo
    const { eventName, sha, ref, workflow, actor, payload } = ctx
    const repoURL = `https://github.com/${owner}/${repo}`
    const workflowURL = `${repoURL}/commit/${sha}/checks`

    logInfo(JSON.stringify(payload))

    const eventFieldTitle = `Event - ${eventName}`
    const eventDetail = formatEvent(eventName, payload)

    let embed: {[key: string]: any} = {
        color: inputs.color || statusOpts[inputs.status].color,
        timestamp: (new Date()).toISOString()
    }
    if (inputs.title) {
        embed.title = inputs.title
    }
    if (inputs.description) {
        embed.description = inputs.description
    }
    if (!inputs.nodetail) {
        embed.title = statusOpts[inputs.status].avatar_url + (embed.title ? `: ${embed.title}` : '')
        embed.fields = [
            {
                name: 'Repository',
                value: `[${owner}/${repo}](${repoURL})`,
                inline: true
            },
            {
                name: 'Ref',
                value: ref,
                inline: true
            },
            {
                name: eventFieldTitle,
                value: eventDetail,
                inline: false
            },
            {
                name: 'Triggered by',
                value: actor,
                inline: true
            },
            {
                name: 'Workflow',
                value: `[${workflow}](${workflowURL})`,
                inline: true
            }
        ]
    }

    let discord_payload: any = {
        embeds: [fitEmbed(embed)]
    }
    logInfo(`embed: ${JSON.stringify(embed)}`)

    if (inputs.username) {
        discord_payload.username = inputs.username
    }
    discord_payload.avatar_url = statusOpts[inputs.status].avatar_url

    return discord_payload
}

run()
