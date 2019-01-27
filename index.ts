import { Observable, of, from, Subscriber } from "rxjs";
import { mergeMap } from "rxjs/operators";

const eventHandlers: {
  sync: EventHandler<DomainEvent>[];
  async: EventHandler<DomainEvent>[];
} = {
  sync: [],
  async: []
};

class EventAsyncSubscriber extends Subscriber<DomainEvent> {
  _next(value: DomainEvent) {
    eventHandlers.async
      .filter(h => h.supports(value))
      .map(h => h.handle(value));

    this.destination.next && this.destination.next(value);
  }
}

class EventSyncSubscriber extends Subscriber<DomainEvent> {
  _next(value: DomainEvent) {
    const supportingHandlers = eventHandlers.sync.filter(h =>
      h.supports(value)
    );

    const syncEvenHandlers = Promise.all(
      eventHandlers.sync
        .filter(h => h.supports(value))
        .map(h => h.handle(value))
    ).then(() => {
      this.destination.next && this.destination.next(value);
    });
  }
}

const asyncHandler = (source: Observable<any>) =>
  source.lift({
    call(sub, source) {
      source.subscribe(new EventAsyncSubscriber(sub));
    }
  });

const syncHandler = (source: Observable<any>) =>
  source.lift({
    call(sub, source) {
      source.subscribe(new EventSyncSubscriber(sub));
    }
  });

interface DomainEvent {
  id: string;
}

interface Command {}

interface Product {
  id: string;
  name: string;
  price: string;
}

interface Cart {
  id: string;
  product: Product[];
}

class AddItemToCartCommand implements Command {
  public constructor(public cartId: string, public productId: string) {}
}

class ItemAddedToCartEvent implements DomainEvent {
  public constructor(public id: string, public productId: string) {}
}

interface RemoveItemFromCartCommand extends Command {
  cartId: string;
  productId: string;
}

interface ItemRemovedFromCartEvent extends DomainEvent {
  id: string;
  productId: string;
}

enum EventHandlerType {
  SYNC,
  ASYNC
}

interface EventHandler<T extends DomainEvent> {
  supports(t: any): t is T;
  handle(t: T): Promise<any>;
}

interface CommandHandler<T extends Command> {
  supports(t: any): t is T;
  handle(t: T): DomainEvent[];
}

function RegisterEvent(type: EventHandlerType) {
  return (...args: any[]) => {
    console.log(args);
  };
}

@RegisterEvent(EventHandlerType.ASYNC)
class ElasticSearchHandler implements EventHandler<ItemAddedToCartEvent> {
  public supports(event: any): event is ItemAddedToCartEvent {
    return event.constructor.name === "ItemAddedToCartEvent";
  }

  public handle(event: ItemAddedToCartEvent) {
    return new Promise(resolve => {
      console.log("adding to elastic search");
      const interval = setInterval(() => {
        console.log("Waiting on elastic");
      }, 500);

      setTimeout(() => {
        console.log("finish to elastic search");
        clearInterval(interval);
        resolve();
      }, 20000);
    });
  }
}

@RegisterEvent(EventHandlerType.SYNC)
class ProjectionHandler implements EventHandler<ItemAddedToCartEvent> {
  public supports(event: any): event is ItemAddedToCartEvent {
    return event.constructor.name === "ItemAddedToCartEvent";
  }

  public handle(event: ItemAddedToCartEvent) {
    console.log("Adding to projection");
    return new Promise(resolve => {
      console.log("finished to projection");
      setTimeout(resolve, 3000);
    });
  }
}

class EventBus {
  public handle(events: DomainEvent[]) {
    return new Promise((resolve, reject) => {
      const subscriber = {
        next: (val: any) => console.log(val),
        complete: () => {
          resolve();
        },
        error: (error: Error) => reject(error)
      };

      const $o = from(events);
      $o.pipe(asyncHandler).subscribe({
        next: () => console.log("async next"),
        complete: () => console.log("Async complete"),
        error: error => console.error(error)
      });
      $o.pipe(syncHandler).subscribe(subscriber);
    });
  }
}

class CommandBus {
  private test = new AddItemToCartCommandHandler();
  private eventBus = new EventBus();

  handle(c: Command): Promise<any> {
    if (this.test.supports(c)) {
      // From these events, we should store them somewhere as the event log _before_ we run the handlers
      const events = this.test.handle(c);
      return this.eventBus.handle(events);
    }

    return Promise.resolve(null);
  }
}

class AddItemToCartCommandHandler
  implements CommandHandler<AddItemToCartCommand> {
  public supports(c: Command): c is AddItemToCartCommand {
    return c.constructor.name === "AddItemToCartCommand";
  }

  public handle(c: AddItemToCartCommand) {
    const event: ItemAddedToCartEvent = new ItemAddedToCartEvent(
      c.cartId,
      c.productId
    );
    return [event];
  }
}

eventHandlers.sync = [new ProjectionHandler()];
eventHandlers.async = [new ElasticSearchHandler()];

new CommandBus().handle(new AddItemToCartCommand("", "")).then(() => {
  console.log("done");
});
