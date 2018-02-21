/*
 * Copyright (c) 2017 by The Kue MultiConsumer Project Developers.
 * Some rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as kue from "kue"
import {
  DynamicallyNamedQueue,
  EventBus, EventBusImpl, MultiConsumerQueueImpl, NamedQueue, NamedQueueWrap,
  ProcessCallback, Queue, QueueTopic, ConsumerGroupId
} from "multiconsumer-queue"
import { createStringsLiveSet } from "redis-liveset"
import * as redis from "redis"

export * from "multiconsumer-queue"

class KueNamedQueue implements NamedQueue<kue.Job> {
  constructor(private readonly _out: kue.Queue) {
  }

  add(topic: QueueTopic, data: any): void {
    this._out.create(topic, data).removeOnComplete(true).save()
  }

  process(topic: QueueTopic, fn: ProcessCallback<kue.Job>, n: number = 1): void {
    this._out.process(topic, n, fn)
  }
}

/**
 * Build new multi-consumer queue
 */
export function MultiConsumerKue(queue: kue.Queue,
                                 redis: () => redis.RedisClient,
                                 liveSetKey: (topic: QueueTopic) => QueueTopic = (topic) => QueueTopic(`QueueMultiConsumerGroups/${topic}`)): EventBus<kue.Job> {
  return new EventBusImpl((topic: QueueTopic) => {
    const kQueue = new KueNamedQueue(queue)
    const src: Queue<kue.Job> = new NamedQueueWrap(topic, kQueue)
    const dest: NamedQueue<kue.Job> = new DynamicallyNamedQueue((groupId) => QueueTopic(`${topic}/${groupId}`), kQueue)
    const groups = createStringsLiveSet(liveSetKey(topic), redis(), redis())

    return new MultiConsumerQueueImpl(src, dest, groups, (job) => job.data)
  })
}

export default MultiConsumerKue
